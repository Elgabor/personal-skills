#!/usr/bin/env python3
"""Collect a small, read-only local-AI hardware inventory.

The script deliberately uses an allow-list of commands, never invokes a shell,
and emits normalized JSON with nulls and an ``unknown`` list instead of guesses.
It does not inspect environment files, credentials, browser data, serial
numbers, or user documents.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


SCHEMA_VERSION = "1"
COMMAND_TIMEOUT_SECONDS = 4


def run_command(argv: Sequence[str], timeout: int = COMMAND_TIMEOUT_SECONDS) -> Optional[str]:
    """Return stdout for a successful allow-listed command, never stderr."""

    if not argv or shutil.which(argv[0]) is None:
        return None
    try:
        completed = subprocess.run(
            list(argv),
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
            stdin=subprocess.DEVNULL,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if completed.returncode != 0:
        return None
    return completed.stdout.strip()


def first_command(commands: Iterable[Sequence[str]]) -> Tuple[Optional[str], Optional[str]]:
    for argv in commands:
        output = run_command(argv)
        if output is not None:
            return output, argv[0]
    return None, None


def parse_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    match = re.search(r"[-+]?\d[\d,]*", str(value))
    if not match:
        return None
    try:
        return int(match.group(0).replace(",", ""))
    except ValueError:
        return None


def parse_memory_bytes(value: Any) -> Optional[int]:
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(bytes?|b|kib|kb|mib|mb|gib|gb|tib|tb)?", text, re.I)
    if not match:
        return None
    amount = float(match.group(1))
    unit = (match.group(2) or "bytes").lower()
    multiplier = {
        "b": 1,
        "byte": 1,
        "bytes": 1,
        "kb": 1000**1,
        "kib": 1024**1,
        "mb": 1000**2,
        "mib": 1024**2,
        "gb": 1000**3,
        "gib": 1024**3,
        "tb": 1000**4,
        "tib": 1024**4,
    }[unit]
    return int(amount * multiplier)


def sysctl(name: str) -> Optional[str]:
    return run_command(["sysctl", "-n", name])


def int_from_text(value: Optional[str]) -> Optional[int]:
    return parse_int(value) if value is not None else None


def mac_memory() -> Tuple[Optional[int], Optional[int], str]:
    total = parse_memory_bytes(sysctl("hw.memsize"))
    vm_stat = run_command(["vm_stat"])
    if vm_stat is None:
        return total, None, "vm_stat unavailable"

    page_size = 4096
    page_size_match = re.search(r"page size of (\d+) bytes", vm_stat)
    if page_size_match:
        page_size = int(page_size_match.group(1))

    pages: Dict[str, int] = {}
    for line in vm_stat.splitlines():
        match = re.match(r"Pages ([^:]+):\s+(\d+)\.", line)
        if match:
            pages[match.group(1).lower()] = int(match.group(2))

    # This is an intentionally labelled approximation. macOS does not expose
    # one portable MemAvailable equivalent through the probes used here.
    available_pages = sum(
        pages.get(name, 0)
        for name in ("free", "inactive", "speculative", "purgeable")
    )
    return total, available_pages * page_size, "vm_stat free+inactive+speculative+purgeable estimate"


def linux_memory() -> Tuple[Optional[int], Optional[int], str]:
    try:
        values: Dict[str, int] = {}
        for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
            key, _, rest = line.partition(":")
            number = parse_int(rest)
            if number is not None:
                values[key] = number * 1024  # /proc/meminfo reports kB.
        return values.get("MemTotal"), values.get("MemAvailable"), "/proc/meminfo"
    except (OSError, UnicodeError):
        return None, None, "/proc/meminfo unavailable"


def powershell_command(command: str) -> Optional[str]:
    for executable in ("pwsh", "powershell"):
        if shutil.which(executable):
            return run_command(
                [executable, "-NoProfile", "-NonInteractive", "-Command", command],
                timeout=8,
            )
    return None


def as_records(value: Any) -> List[Dict[str, Any]]:
    if isinstance(value, dict):
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def json_command(command: str) -> List[Dict[str, Any]]:
    output = powershell_command(command)
    if not output:
        return []
    try:
        return as_records(json.loads(output))
    except json.JSONDecodeError:
        return []


def parse_csv_lines(output: str) -> List[List[str]]:
    rows: List[List[str]] = []
    for line in output.splitlines():
        rows.append([item.strip() for item in line.split(",")])
    return rows


def nvidia_gpus() -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    query = run_command(
        [
            "nvidia-smi",
            "--query-gpu=name,memory.total,driver_version",
            "--format=csv,noheader,nounits",
        ]
    )
    general = run_command(["nvidia-smi"])
    if query is None:
        return [], {
            "status": "unknown" if shutil.which("nvidia-smi") is None else "not_detected",
            "source": "nvidia-smi",
        }

    cuda_match = re.search(r"CUDA Version:\s*([^\s]+)", general or "")
    gpus: List[Dict[str, Any]] = []
    for row in parse_csv_lines(query):
        if not row:
            continue
        gpus.append(
            {
                "name": row[0] or None,
                "vram_bytes": parse_memory_bytes(f"{row[1]} MiB") if len(row) > 1 else None,
                "driver_version": row[2] if len(row) > 2 and row[2] else None,
                "source": "nvidia-smi",
            }
        )
    backend = {"status": "available", "source": "nvidia-smi"}
    if cuda_match:
        backend["cuda_version"] = cuda_match.group(1)
    return gpus, backend


def rocm_gpus() -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    output, command = first_command(
        [
            ["rocm-smi", "--showproductname", "--showmeminfo", "vram", "--csv"],
            ["rocm-smi", "--showproductname", "--showmeminfo", "vram"],
        ]
    )
    if output is None:
        rocminfo = run_command(["rocminfo"])
        if rocminfo is not None:
            return [], {"status": "installed", "source": "rocminfo", "vram": "unknown"}
        return [], {
            "status": "unknown" if shutil.which("rocm-smi") is None else "not_detected",
            "source": "rocm-smi",
        }

    names = re.findall(r"(?:Card series|Product Name|GPU\[\d+\])\s*[:=,]?\s*([^,\n]+)", output, re.I)
    memory_values = re.findall(
        r"(?:VRAM[^:=,\n]*|memory[^:=,\n]*)[:=,]?\s*([0-9]+(?:\.[0-9]+)?)\s*(B|KB|MB|GB|KiB|MiB|GiB)",
        output,
        re.I,
    )
    gpus: List[Dict[str, Any]] = []
    count = max(len(names), len(memory_values), 1)
    for index in range(count):
        vram = None
        if index < len(memory_values):
            vram = parse_memory_bytes(f"{memory_values[index][0]} {memory_values[index][1]}")
        gpus.append(
            {
                "name": names[index].strip() if index < len(names) else None,
                "vram_bytes": vram,
                "driver_version": None,
                "source": command or "rocm-smi",
            }
        )
    return gpus, {"status": "available", "source": command or "rocm-smi"}


def mac_gpus() -> List[Dict[str, Any]]:
    output = run_command(["system_profiler", "SPDisplaysDataType", "-json"], timeout=8)
    if output is None:
        return []
    try:
        payload = json.loads(output)
    except json.JSONDecodeError:
        return []

    gpus: List[Dict[str, Any]] = []

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            model = None
            for key in ("sppci_model", "_name", "spdisplays_vendor"):
                if isinstance(value.get(key), str) and value[key].strip():
                    model = value[key].strip()
                    break
            if model and any(token in model.lower() for token in ("gpu", "graphics", "apple", "amd", "intel", "nvidia")):
                vram = None
                for key, candidate in value.items():
                    if "vram" in str(key).lower():
                        vram = parse_memory_bytes(candidate)
                        if vram is not None:
                            break
                gpus.append(
                    {
                        "name": model,
                        "vram_bytes": vram,
                        "driver_version": None,
                        "source": "system_profiler SPDisplaysDataType",
                    }
                )
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(payload)
    unique: List[Dict[str, Any]] = []
    seen = set()
    for gpu in gpus:
        key = (gpu.get("name"), gpu.get("vram_bytes"))
        if key not in seen:
            unique.append(gpu)
            seen.add(key)
    return unique


def lspci_gpus() -> List[Dict[str, Any]]:
    output = run_command(["lspci", "-mm"])
    if output is None:
        return []
    gpus: List[Dict[str, Any]] = []
    for line in output.splitlines():
        try:
            fields = shlex.split(line)
        except ValueError:
            continue
        if len(fields) < 3:
            continue
        device_class = fields[1].lower()
        if not any(token in device_class for token in ("vga", "3d", "display")):
            continue
        name = " ".join(fields[2:]).strip() or None
        gpus.append(
            {
                "name": name,
                "vram_bytes": None,
                "driver_version": None,
                "source": "lspci -mm",
            }
        )
    return gpus


def linux_cpu() -> Tuple[Optional[str], Optional[int], Optional[int]]:
    model = None
    try:
        for line in Path("/proc/cpuinfo").read_text(encoding="utf-8").splitlines():
            key, _, value = line.partition(":")
            if key.strip().lower() in ("model name", "hardware", "processor") and value.strip():
                model = value.strip()
                break
    except (OSError, UnicodeError):
        pass

    logical = os.cpu_count()
    physical = None
    output = run_command(["lscpu", "-p=CORE,SOCKET"])
    if output:
        pairs = set()
        for line in output.splitlines():
            if line.startswith("#"):
                continue
            parts = line.split(",")
            if len(parts) == 2 and all(part.isdigit() for part in parts):
                pairs.add(tuple(parts))
        physical = len(pairs) or None
    return model, physical, logical


def python_package_versions() -> Dict[str, Any]:
    # Use a simpler script after checking that a Python executable exists. The
    # package metadata lookup does not import model code or inspect user files.
    script = (
        "import importlib.metadata as m, json; "
        "names=['mlx','mlx-lm','vllm','torch','transformers']; "
        "out={}; "
        "\nfor n in names:\n"
        "    try: out[n]=m.version(n)\n"
        "    except m.PackageNotFoundError: pass\n"
        "print(json.dumps(out, sort_keys=True))"
    )
    output, executable = first_command(
        [[name, "-c", script] for name in ("python3", "python", "py")]
    )
    if output is None:
        return {}
    try:
        values = json.loads(output)
        return {"executable": executable, "packages": values if isinstance(values, dict) else {}}
    except json.JSONDecodeError:
        return {"executable": executable, "packages": {}}


def cli_version(command: str, args: Sequence[str] = ("--version",)) -> Dict[str, Any]:
    if shutil.which(command) is None:
        return {"available": False, "command": command, "version": None}
    output = run_command([command, *args])
    return {"available": output is not None, "command": command, "version": output}


def collect_software() -> Dict[str, Any]:
    software: Dict[str, Any] = {
        "ollama": cli_version("ollama"),
        "llama.cpp": {"available": False, "command": None, "version": None},
        "vllm": cli_version("vllm"),
        "mlx": {"available": False, "command": None, "version": None},
    }
    for command in ("llama-server", "llama-cli", "llama"):
        value = cli_version(command)
        if value["available"]:
            software["llama.cpp"] = {**value, "command": command}
            break
    package_info = python_package_versions()
    for package_name, software_name in (("mlx", "mlx"), ("vllm", "vllm")):
        version = package_info.get("packages", {}).get(package_name)
        if version:
            software[software_name] = {
                "available": True,
                "command": package_info.get("executable"),
                "version": version,
                "source": "Python package metadata",
            }
    software["python"] = cli_version("python3") if shutil.which("python3") else cli_version("python")
    software["node"] = cli_version("node")
    software["package_metadata_probe"] = package_info
    return software


def collect() -> Dict[str, Any]:
    system_name = platform.system() or "unknown"
    architecture = platform.machine() or None
    cpu_model: Optional[str] = None
    physical_cores: Optional[int] = None
    logical_cores: Optional[int] = os.cpu_count()
    memory_total: Optional[int] = None
    memory_available: Optional[int] = None
    memory_basis = "unknown"
    gpus: List[Dict[str, Any]] = []
    backends: Dict[str, Any] = {"CPU": {"status": "available", "source": "operating system"}}

    if system_name == "Darwin":
        cpu_model = sysctl("machdep.cpu.brand_string") or sysctl("hw.model")
        physical_cores = int_from_text(sysctl("hw.physicalcpu"))
        logical_cores = int_from_text(sysctl("hw.logicalcpu")) or logical_cores
        memory_total, memory_available, memory_basis = mac_memory()
        gpus = mac_gpus()
        backends["Metal"] = {
            "status": "available",
            "source": "macOS; API presence detected, workload support not benchmarked",
        }
    elif system_name == "Linux":
        cpu_model, physical_cores, logical_cores = linux_cpu()
        memory_total, memory_available, memory_basis = linux_memory()
        nvidia, cuda = nvidia_gpus()
        amd, rocm = rocm_gpus()
        gpus = nvidia + amd
        if not gpus:
            gpus = lspci_gpus()
        backends["CUDA"] = cuda
        backends["ROCm"] = rocm
    elif system_name == "Windows":
        processor = json_command(
            "Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors | ConvertTo-Json -Compress"
        )
        if processor:
            record = processor[0]
            cpu_model = record.get("Name")
            physical_cores = parse_int(record.get("NumberOfCores"))
            logical_cores = parse_int(record.get("NumberOfLogicalProcessors")) or logical_cores
        computer = json_command(
            "Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory | ConvertTo-Json -Compress"
        )
        if computer:
            memory_total = parse_memory_bytes(computer[0].get("TotalPhysicalMemory"))
        operating_system = json_command(
            "Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory | ConvertTo-Json -Compress"
        )
        if operating_system:
            memory_available = parse_memory_bytes(f"{operating_system[0].get('FreePhysicalMemory')} KiB")
        memory_basis = "Windows CIM"
        video = json_command(
            "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json -Compress"
        )
        for record in video:
            gpus.append(
                {
                    "name": record.get("Name"),
                    "vram_bytes": parse_memory_bytes(record.get("AdapterRAM")),
                    "driver_version": record.get("DriverVersion"),
                    "source": "Win32_VideoController",
                }
            )
        nvidia, cuda = nvidia_gpus()
        amd, rocm = rocm_gpus()
        if nvidia:
            gpus = nvidia
        elif amd:
            gpus.extend(amd)
        backends["CUDA"] = cuda
        backends["ROCm"] = rocm
    else:
        cpu_model = platform.processor() or None

    disk_path = os.path.abspath(os.sep)
    try:
        disk_free = shutil.disk_usage(disk_path).free
    except OSError:
        disk_free = None

    software = collect_software()
    for backend_name, command in (("Vulkan", ["vulkaninfo", "--summary"]), ("OpenCL", ["clinfo", "-l"])):
        probe = run_command(command, timeout=6)
        backends[backend_name] = {
            "status": "available" if probe is not None else "unknown",
            "source": command[0],
        }
    if system_name == "Linux" and not gpus and backends.get("CUDA", {}).get("status") == "unknown":
        backends["CUDA"] = {"status": "unknown", "source": "no GPU probe result"}

    result: Dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "system": {
            "operating_system": {
                "name": system_name,
                "release": platform.release() or None,
                "architecture": architecture,
            },
            "cpu": {
                "model": cpu_model,
                "physical_cores": physical_cores,
                "logical_cores": logical_cores,
            },
            "memory": {
                "total_bytes": memory_total,
                "available_bytes": memory_available,
                "available_basis": memory_basis,
            },
            "gpus": gpus,
            "backends": backends,
            "disk": {"path": disk_path, "free_bytes": disk_free},
            "software": software,
        },
    }
    result["unknown"] = unknown_paths(result["system"])
    if not gpus:
        result["unknown"].append("system.gpus (no GPU detected or probe unavailable)")
    return result


def unknown_paths(value: Any, prefix: str = "system") -> List[str]:
    missing: List[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            current = f"{prefix}.{key}"
            if child is None:
                missing.append(current)
            elif isinstance(child, (dict, list)):
                missing.extend(unknown_paths(child, current))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            missing.extend(unknown_paths(child, f"{prefix}[{index}]"))
    return missing


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compact", action="store_true", help="emit one compact JSON line")
    args = parser.parse_args()
    payload = json.dumps(collect(), ensure_ascii=False, sort_keys=True, indent=None if args.compact else 2)
    print(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
