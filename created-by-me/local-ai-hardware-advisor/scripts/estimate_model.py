#!/usr/bin/env python3
"""Estimate local-model memory placement from normalized JSON inputs.

This is a conservative estimator, not a benchmark. It reports provenance,
assumptions, missing fields, and separate load/use/task claims. It has no
network, package, model, or filesystem side effects beyond reading the two
explicit JSON files supplied by the caller.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


GIB = 1024**3
MIB = 1024**2
STATUS = ("COMODA", "POSSIBILE", "AL LIMITE", "NON ADATTA", "NON VERIFICABILE")


def read_json(path: Optional[str], inline: Optional[str], label: str) -> Dict[str, Any]:
    if inline is not None:
        value = json.loads(inline)
    elif path == "-":
        value = json.load(sys.stdin)
    elif path:
        with Path(path).open("r", encoding="utf-8") as handle:
            value = json.load(handle)
    else:
        raise ValueError(f"missing {label} input")
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be a JSON object")
    return value


def number(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def integer(value: Any) -> Optional[int]:
    parsed = number(value)
    return int(parsed) if parsed is not None and parsed >= 0 else None


def bytes_from_gib(value: float) -> int:
    return int(value * GIB)


def quantization_effective_bits(model: Dict[str, Any]) -> Tuple[Optional[float], str]:
    explicit = number(model.get("quantization_bits"))
    if explicit is not None and explicit > 0:
        return explicit, "DICHIARATO"

    label = str(model.get("quantization") or "").lower()
    patterns = (
        (r"(?:^|[^0-9])2(?:-?bit|[_-])|q2", 2.5),
        (r"(?:^|[^0-9])3(?:-?bit|[_-])|q3", 3.5),
        (r"(?:^|[^0-9])4(?:-?bit|[_-])|q4", 4.5),
        (r"(?:^|[^0-9])5(?:-?bit|[_-])|q5", 5.5),
        (r"(?:^|[^0-9])6(?:-?bit|[_-])|q6", 6.5),
        (r"(?:^|[^0-9])8(?:-?bit|[_-])|q8|int8", 8.5),
    )
    for pattern, effective_bits in patterns:
        if re.search(pattern, label):
            return effective_bits, "STIMATO"
    if any(token in label for token in ("bf16", "bfloat16", "fp16", "float16", "f16")):
        return 16.0, "DICHIARATO"
    if any(token in label for token in ("fp32", "float32", "f32")):
        return 32.0, "DICHIARATO"
    return None, "MANCANTE"


def model_root(model_input: Dict[str, Any]) -> Dict[str, Any]:
    nested = model_input.get("model")
    return nested if isinstance(nested, dict) else model_input


def system_root(system_input: Dict[str, Any]) -> Dict[str, Any]:
    nested = system_input.get("system")
    return nested if isinstance(nested, dict) else system_input


def estimate_weights(model: Dict[str, Any], missing: List[str], assumptions: List[str]) -> Dict[str, Any]:
    direct = integer(model.get("weight_size_bytes"))
    if direct is not None and direct > 0:
        return {"bytes": direct, "gib": direct / GIB, "basis": "DICHIARATO/MISURATO"}

    params_b = number(model.get("parameters_b"))
    bits, bit_basis = quantization_effective_bits(model)
    if params_b is None or params_b <= 0:
        missing.append("model.parameters_b or model.weight_size_bytes")
        return {"bytes": None, "gib": None, "basis": "MANCANTE"}
    if bits is None:
        missing.append("model.quantization_bits or model.quantization")
        return {"bytes": None, "gib": None, "basis": "MANCANTE", "parameters_b": params_b}

    estimated = int(params_b * 1_000_000_000 * bits / 8)
    assumptions.append(
        f"Pesi stimati da {params_b:g}B parametri e {bits:g} bit effettivi; overhead di quantizzazione incluso nell'efficienza stimata."
    )
    return {
        "bytes": estimated,
        "gib": estimated / GIB,
        "basis": bit_basis,
        "parameters_b": params_b,
        "effective_bits": bits,
    }


def architecture_values(model: Dict[str, Any]) -> Tuple[Optional[int], Optional[int], Optional[int], str]:
    layers = integer(model.get("num_layers"))
    kv_heads = integer(model.get("num_kv_heads"))
    head_dim = integer(model.get("head_dim"))
    basis = "DICHIARATO"
    if head_dim is None:
        hidden = integer(model.get("hidden_size"))
        attention_heads = integer(model.get("num_attention_heads"))
        if hidden and attention_heads and hidden % attention_heads == 0:
            head_dim = hidden // attention_heads
            basis = "STIMATO"
    return layers, kv_heads, head_dim, basis


def context_tokens(model: Dict[str, Any], missing: List[str]) -> Tuple[Optional[int], Optional[int], str]:
    requested = integer(model.get("requested_context_tokens"))
    declared = integer(model.get("declared_context_tokens"))
    if requested is None:
        requested = declared
    if requested is None:
        missing.append("model.requested_context_tokens or model.declared_context_tokens")
        return None, declared, "MANCANTE"
    if declared is not None and requested > declared:
        missing.append("requested context exceeds declared context window")
        return requested, declared, "NON ADATTA"
    return requested, declared, "DICHIARATO" if model.get("requested_context_tokens") is not None else "DICHIARATO"


def estimate_kv_cache(
    model: Dict[str, Any],
    context: Optional[int],
    missing: List[str],
    assumptions: List[str],
) -> Dict[str, Any]:
    declared = integer(model.get("kv_cache_bytes"))
    if declared is not None and declared > 0:
        return {"bytes": declared, "gib": declared / GIB, "basis": "DICHIARATO"}
    if context is None:
        return {"bytes": None, "gib": None, "basis": "MANCANTE"}

    layers, kv_heads, head_dim, architecture_basis = architecture_values(model)
    if layers is None:
        missing.append("model.num_layers")
    if kv_heads is None:
        missing.append("model.num_kv_heads")
    if head_dim is None:
        missing.append("model.head_dim or hidden_size/num_attention_heads")
    if None in (layers, kv_heads, head_dim):
        return {"bytes": None, "gib": None, "basis": "MANCANTE", "context_tokens": context}

    dtype_bytes = number(model.get("kv_cache_dtype_bytes"))
    if dtype_bytes is None or dtype_bytes <= 0:
        dtype_bytes = 2.0
        assumptions.append("KV cache stimata a 2 byte per elemento (FP16/BF16) perché il dtype non è dichiarato.")
        dtype_basis = "ASSUNTO"
    else:
        dtype_basis = "DICHIARATO"
    batch = number(model.get("batch_size"))
    if batch is None or batch <= 0:
        batch = 1.0
        assumptions.append("Batch size assunto pari a 1.")
        batch_basis = "ASSUNTO"
    else:
        batch_basis = "DICHIARATO"

    # Two tensors (K and V) per layer, per sequence position.
    estimated = int(2 * layers * kv_heads * head_dim * context * batch * dtype_bytes)
    return {
        "bytes": estimated,
        "gib": estimated / GIB,
        "basis": "CALCOLATO",
        "architecture_basis": architecture_basis,
        "dtype_basis": dtype_basis,
        "batch_basis": batch_basis,
        "context_tokens": context,
        "batch_size": batch,
    }


def estimate_runtime_overhead(weights: Dict[str, Any], model: Dict[str, Any], assumptions: List[str]) -> Dict[str, Any]:
    direct = integer(model.get("runtime_overhead_bytes"))
    if direct is not None and direct >= 0:
        return {"bytes": direct, "gib": direct / GIB, "basis": "DICHIARATO"}
    if weights.get("bytes") is None:
        return {"bytes": None, "gib": None, "basis": "MANCANTE"}
    estimated = int(weights["bytes"] * 0.15 + 0.5 * GIB)
    assumptions.append("Overhead runtime assunto come 15% dei pesi + 0,5 GiB; varia per backend, grafo e offloading.")
    return {"bytes": estimated, "gib": estimated / GIB, "basis": "ASSUNTO"}


def estimate_lora(model: Dict[str, Any], missing: List[str], assumptions: List[str]) -> Dict[str, Any]:
    fine_tuning = model.get("fine_tuning")
    if not isinstance(fine_tuning, dict) or not fine_tuning.get("requested"):
        return {"requested": False, "extra_bytes": 0, "extra_gib": 0.0, "basis": "NON RICHIESTO"}
    trainable_b = number(fine_tuning.get("lora_trainable_params_b"))
    if trainable_b is None or trainable_b < 0:
        missing.append("fine_tuning.lora_trainable_params_b")
        return {"requested": True, "extra_bytes": None, "extra_gib": None, "basis": "MANCANTE"}
    optimizer_bytes = number(fine_tuning.get("optimizer_bytes_per_param"))
    if optimizer_bytes is None or optimizer_bytes < 0:
        optimizer_bytes = 8.0
        assumptions.append("Stato optimizer LoRA assunto a 8 byte per parametro; dipende dall'optimizer e dal training setup.")
        optimizer_basis = "ASSUNTO"
    else:
        optimizer_basis = "DICHIARATO"
    # Adapter weights + gradients + optimizer state. Activations are separate
    # and intentionally not guessed.
    trainable_params = trainable_b * 1_000_000_000
    extra = int(trainable_params * (2 + 2 + optimizer_bytes))
    return {
        "requested": True,
        "trainable_parameters_b": trainable_b,
        "extra_bytes": extra,
        "extra_gib": extra / GIB,
        "optimizer_basis": optimizer_basis,
        "basis": "CALCOLATO",
        "activation_memory": "NON STIMATA",
    }


def gpu_inventory(system: Dict[str, Any]) -> List[Dict[str, Any]]:
    values = system.get("gpus")
    return values if isinstance(values, list) else []


def choose_target(system: Dict[str, Any], model: Dict[str, Any], requested: str, multi_gpu: bool) -> Dict[str, Any]:
    gpus = gpu_inventory(system)
    known = [gpu for gpu in gpus if isinstance(gpu, dict) and integer(gpu.get("vram_bytes"))]
    if requested == "cpu" or (requested == "auto" and not known):
        memory = system.get("memory") if isinstance(system.get("memory"), dict) else {}
        return {
            "device": "cpu",
            "capacity_bytes": integer(memory.get("available_bytes")) or integer(memory.get("total_bytes")),
            "capacity_basis": "MISURATO" if memory.get("available_bytes") is not None else "DICHIARATO",
            "name": system.get("cpu", {}).get("model") if isinstance(system.get("cpu"), dict) else None,
        }
    if not known:
        return {"device": "gpu", "capacity_bytes": None, "capacity_basis": "MANCANTE", "name": None}
    if multi_gpu:
        capacity = sum(integer(gpu.get("vram_bytes")) or 0 for gpu in known)
        names = [str(gpu.get("name")) for gpu in known if gpu.get("name")]
        return {
            "device": "gpu",
            "capacity_bytes": capacity,
            "capacity_basis": "MISURATO",
            "name": ", ".join(names) or None,
            "gpu_count": len(known),
            "multi_gpu": True,
        }
    selected = max(known, key=lambda gpu: integer(gpu.get("vram_bytes")) or 0)
    return {
        "device": "gpu",
        "capacity_bytes": integer(selected.get("vram_bytes")),
        "capacity_basis": "MISURATO",
        "name": selected.get("name"),
        "gpu_count": 1,
        "multi_gpu": False,
    }


def backend_status(system: Dict[str, Any], model: Dict[str, Any], target: Dict[str, Any]) -> Dict[str, Any]:
    if target["device"] == "cpu":
        return {"status": "available", "source": "CPU fallback"}
    declared = model.get("backend_support")
    backends = system.get("backends") if isinstance(system.get("backends"), dict) else {}
    if not isinstance(declared, list) or not declared:
        return {"status": "unknown", "source": "model backend support not declared"}
    normalized = [str(value).lower() for value in declared]
    for name, probe in backends.items():
        if str(name).lower() in normalized and isinstance(probe, dict):
            return {"status": probe.get("status", "unknown"), "backend": name, "source": probe.get("source")}
    return {"status": "unknown", "source": "no matching declared backend probe"}


def classify(required: Optional[int], capacity: Optional[int], reserve: int, missing: List[str], context_state: str) -> str:
    if context_state == "NON ADATTA":
        return "NON ADATTA"
    if required is None or capacity is None or missing:
        return "NON VERIFICABILE"
    if required > capacity:
        return "NON ADATTA"
    margin = capacity - required
    if margin >= reserve and required <= int(capacity * 0.75):
        return "COMODA"
    if margin >= reserve:
        return "POSSIBILE"
    if margin >= 0:
        return "AL LIMITE"
    return "NON ADATTA"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--system", help="normalized system JSON path, or - for stdin")
    parser.add_argument("--model", help="normalized model JSON path")
    parser.add_argument("--system-json", help="normalized system JSON object")
    parser.add_argument("--model-json", help="normalized model JSON object")
    parser.add_argument("--device", choices=("auto", "cpu", "gpu"), default="auto")
    parser.add_argument("--multi-gpu", action="store_true", help="sum known VRAM only when explicitly requested")
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()

    try:
        system_input = read_json(args.system, args.system_json, "system")
        model_input = read_json(args.model, args.model_json, "model")
    except (OSError, ValueError, json.JSONDecodeError) as error:
        parser.error(str(error))

    system = system_root(system_input)
    model = model_root(model_input)
    missing: List[str] = []
    assumptions: List[str] = []

    weights = estimate_weights(model, missing, assumptions)
    context, declared_context, context_basis = context_tokens(model, missing)
    kv_cache = estimate_kv_cache(model, context, missing, assumptions)
    overhead = estimate_runtime_overhead(weights, model, assumptions)
    lora = estimate_lora(model, missing, assumptions)

    total_parts = [weights.get("bytes"), overhead.get("bytes"), kv_cache.get("bytes")]
    total_memory = sum(total_parts) if all(value is not None for value in total_parts) else None
    target = choose_target(system, model, args.device, args.multi_gpu)
    capacity = target.get("capacity_bytes")
    reserve = GIB if target["device"] == "gpu" else 4 * GIB
    memory_status = classify(total_memory, capacity, reserve, missing, context_basis)
    backend = backend_status(system, model, target)

    if total_memory is not None and capacity is not None and kv_cache.get("bytes") is not None:
        available_for_kv = max(0, capacity - reserve - (weights.get("bytes") or 0) - (overhead.get("bytes") or 0))
        per_token = kv_cache["bytes"] / max(context or 1, 1)
        memory_context = int(available_for_kv / per_token) if per_token else None
        if declared_context is not None and memory_context is not None:
            realistic_context = min(declared_context, memory_context)
        else:
            realistic_context = memory_context
    else:
        memory_context = None
        realistic_context = None

    disk = system.get("disk") if isinstance(system.get("disk"), dict) else {}
    disk_free = integer(disk.get("free_bytes"))
    if weights.get("bytes") is not None:
        disk_required = int(weights["bytes"] * 1.10 + 1 * GIB)
        assumptions.append("Spazio disco richiesto assunto come peso artifact + 10% + 1 GiB per file temporanei/metadati.")
        disk_status = "COMODA" if disk_free is not None and disk_free >= disk_required else (
            "NON VERIFICABILE" if disk_free is None else "NON ADATTA"
        )
    else:
        disk_required = None
        disk_status = "NON VERIFICABILE"

    result = {
        "model": {
            "id": model.get("model_id") or model.get("name") or "unknown",
            "format": model.get("format"),
            "quantization": model.get("quantization"),
            "architecture": model.get("architecture"),
        },
        "target": target,
        "status": memory_status,
        "claims": {
            "caricabile": memory_status,
            "utilizzabile": memory_status if realistic_context is not None else "NON VERIFICABILE",
            "adatta_al_task": "NON VERIFICABILE",
        },
        "memory": {
            "weights": weights,
            "runtime_overhead": overhead,
            "kv_cache": kv_cache,
            "total_model_memory": {
                "bytes": total_memory,
                "gib": total_memory / GIB if total_memory is not None else None,
                "basis": "CALCOLATO" if total_memory is not None else "MANCANTE",
            },
            "capacity": {
                "bytes": capacity,
                "gib": capacity / GIB if capacity is not None else None,
                "reserve_bytes": reserve,
                "basis": target.get("capacity_basis"),
            },
            "residual_bytes": capacity - total_memory if capacity is not None and total_memory is not None else None,
            "lora_or_fine_tuning": lora,
        },
        "context": {
            "requested_tokens": context,
            "declared_tokens": declared_context,
            "realistic_tokens": realistic_context,
            "memory_limited_tokens": memory_context,
            "basis": context_basis,
        },
        "disk": {
            "free_bytes": disk_free,
            "estimated_required_bytes": disk_required,
            "status": disk_status,
        },
        "backend": backend,
        "performance": {
            "status": "NON MISURATA",
            "tokens_per_second": None,
            "latency": None,
            "note": "Misurare con il backend, prompt, context e batch reali; il caricamento teorico non è un benchmark.",
        },
        "missing_inputs": sorted(set(missing)),
        "assumptions": assumptions,
    }
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=None if args.compact else 2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        raise SystemExit(0)
