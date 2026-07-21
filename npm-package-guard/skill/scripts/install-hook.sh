#!/bin/bash

# This script runs before every Bash tool call. Keep the non-install path cheap.
set +e

payload=$(</dev/stdin)

# Inspect the raw JSON first. JSON preserves ordinary command spaces, so a
# non-match proves this is not one of the install forms without starting jq or
# Node. A false positive is harmless: the exact parser runs below.
command_boundary='("command"[[:space:]]*:[[:space:]]*"|[;&|][[:space:]]*)'
command_prefix='[[:space:]]*((sudo|command)[[:space:]]+)?(env[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*([^[:space:]]*/)?'
value_option='((--registry|--prefix|--workspace|-w|--cache|--userconfig|--config|--cwd|--dir|--filter|--store-dir)[[:space:]]+[^[:space:]]+[[:space:]]+|(--registry|--prefix|--workspace|--cache|--userconfig|--config|--cwd|--dir|--filter|--store-dir)=[^[:space:]]+[[:space:]]+)'
boolean_option='--[A-Za-z0-9-]+[[:space:]]+'
install_form="(npm[[:space:]]+(${value_option}|${boolean_option})*(install|i|add)|pnpm[[:space:]]+(${value_option}|${boolean_option})*(install|i|add)|yarn[[:space:]]+(${value_option}|${boolean_option})*(install|add)|bun[[:space:]]+(${value_option}|${boolean_option})*(install|i|add)|npx[[:space:]]+)"
if ! [[ "$payload" =~ ${command_boundary}${command_prefix}${install_form} ]]; then
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "npm-package-guard warning: jq is unavailable; allowing command without package checks." >&2
  exit 0
fi

command_text=$(printf '%s' "$payload" | jq -r '.tool_input.command // .toolInput.command // .command // empty' 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "npm-package-guard warning: could not parse hook input; allowing command." >&2
  exit 0
fi

script_dir="${BASH_SOURCE[0]%/*}"
if ! command -v node >/dev/null 2>&1; then
  echo "npm-package-guard warning: node is unavailable; allowing install command without package checks." >&2
  exit 0
fi

node "$script_dir/npm-package-guard.js" hook-command "$command_text"
status=$?
if [ "$status" -eq 2 ]; then
  exit 2
fi
if [ "$status" -ne 0 ]; then
  echo "npm-package-guard warning: checker exited unexpectedly; allowing command." >&2
fi
exit 0
