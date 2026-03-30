#!/bin/bash
# forge-spawn: Lanza un agente Claude Code en proceso aislado con contexto limpio.
#
# Uso: ./lib/spawn.sh <task-file> <result-file> [timeout_seconds]
#
# El agente lee task-file, ejecuta, escribe resultado en result-file.
# Contexto 100% limpio por invocación.

set -euo pipefail

TASK_FILE="${1:?Usage: spawn.sh <task-file> <result-file> [timeout]}"
RESULT_FILE="${2:?Usage: spawn.sh <task-file> <result-file> [timeout]}"
TIMEOUT="${3:-300}"  # 5 minutos default

# Verificar que el task file existe
if [ ! -f "$TASK_FILE" ]; then
  echo "ERROR: Task file not found: $TASK_FILE" >&2
  exit 1
fi

# Directorio del proyecto (donde está .forge/)
PROJECT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# Construir prompt mínimo que apunta al task file
PROMPT="You are a forge worker agent. Read your task specification from: $TASK_FILE

Execute the task exactly as specified. Write your results to: $RESULT_FILE

Rules:
- Read the task file FIRST before doing anything
- Follow the instructions in the task file precisely
- Write structured output to the result file (JSON format)
- Do NOT read files outside what the task requires
- Be concise — minimize context usage
- If something fails after 2 attempts, write the error to the result file and stop

Working directory: $PROJECT_DIR"

# Spawn claude en proceso aislado
# --output-format stream-json para poder monitorear progreso
# timeout para evitar procesos zombie
cd "$PROJECT_DIR"

if command -v claude &>/dev/null; then
  # Claude Code CLI disponible
  timeout "$TIMEOUT" claude -p "$PROMPT" \
    --output-format stream-json \
    --verbose 2>/dev/null || {
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 124 ]; then
      echo '{"status":"timeout","error":"Agent timed out after '$TIMEOUT's"}' > "$RESULT_FILE"
    elif [ ! -f "$RESULT_FILE" ]; then
      echo '{"status":"error","error":"Agent exited with code '$EXIT_CODE' and produced no output"}' > "$RESULT_FILE"
    fi
    exit $EXIT_CODE
  }
else
  echo "ERROR: claude CLI not found. Install Claude Code first." >&2
  echo '{"status":"error","error":"claude CLI not available"}' > "$RESULT_FILE"
  exit 1
fi

# Verificar que se generó el resultado
if [ ! -f "$RESULT_FILE" ]; then
  echo '{"status":"error","error":"Agent completed but produced no result file"}' > "$RESULT_FILE"
  exit 1
fi

echo "✅ Agent completed. Result: $RESULT_FILE"
