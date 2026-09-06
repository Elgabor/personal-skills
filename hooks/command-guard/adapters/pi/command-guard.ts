// Local Pi adapter for davidondrej/skills hooks, revision cd76b13595e8d370dd68c5fe5b48b00afc17d392.
// Calls the shared guard without evaluating the submitted command.
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function commandGuard(pi: ExtensionAPI) {
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return;
    const command = event.input.command;
    if (typeof command !== "string") {
      return { block: true, reason: "Command guard: invalid bash input." };
    }
    const result = spawnSync(join(homedir(), ".agents/hooks/deny-dangerous.sh"), [], {
      input: JSON.stringify({ tool_input: { command } }),
      encoding: "utf8", timeout: 10000, maxBuffer: 65536,
    });
    if (result.status === 2) {
      return { block: true, reason: result.stderr.trim() || "Blocked by command guard." };
    }
    if (result.error || result.status !== 0) {
      return { block: true, reason: "Command guard unavailable; report this failure to the user." };
    }
  });
}
