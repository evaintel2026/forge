---
name: build
version: 2.0.0
description: |
  Orquestador principal. Encadena plan → implement → test → fix → review → ship
  usando procesos aislados con contexto limpio. Cada agente nace, trabaja, muere.
  Use when: "build this", "construir", "implementar feature completa".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
  - Agent
---

# /build — Orquestador con Context Isolation

Coordinas el flujo completo. Cada paso se ejecuta en un **proceso aislado**
con contexto limpio. La comunicación es por archivos, no por contexto.

## Arquitectura de Context Isolation

```
/build (orquestador — contexto limpio)
    │
    │  Escribe: .forge/tasks/plan-{slug}.md
    │  Spawn:   claude -p (proceso nuevo, contexto 0%)
    │  Lee:     .forge/results/plan-{slug}.json (resumen ~30 líneas)
    │
    │  Escribe: .forge/tasks/impl-T1.md
    │  Spawn:   claude -p (proceso nuevo, contexto 0%)
    │  Lee:     .forge/results/impl-T1.json (resumen ~20 líneas)
    │
    │  Escribe: .forge/tasks/impl-T2.md
    │  Spawn:   claude -p (proceso nuevo, contexto 0%)  ← PARALELO si independiente
    │  Lee:     .forge/results/impl-T2.json
    │
    │  ... (test, fix, review — cada uno proceso aislado)
    │
    └── El orquestador NUNCA lee diffs/código directamente
        Solo lee JSONs de resultado (~resúmenes)
```

**Regla de oro: el orquestador consume ~5% del contexto. Los workers se queman y mueren.**

## Invocación

- `/build "Add Stripe payment integration"` — flujo completo
- `/build --from issue #42` — desde un issue de GitHub
- `/build --resume` — continuar flujo interrumpido
- `/build --skip-plan` — saltar planificación (plan ya existe)
- `/build --dry-run` — solo planificar, no implementar

## Directorios de trabajo

```bash
mkdir -p .forge/{tasks,results,builds,plans,reports}
```

## Flujo Principal

### Fase 1: Planificación (interactivo)

La planificación es INTERACTIVA (no aislada) porque requiere aprobación del usuario.

1. Ejecutar `/plan` normalmente
2. Esperar aprobación del usuario
3. Guardar plan aprobado en `.forge/plans/{slug}.md`

### Fase 2: Implementación (aislada, parallelizable)

Para cada tarea del plan, crear un task file y spawnearlo:

**Escribir task file** `.forge/tasks/impl-T{N}.md`:

```markdown
# Task: impl-T{N}

## Tipo
implement

## Objetivo
{Copiar título y descripción de la tarea del plan}

## Input
- Plan: .forge/plans/{slug}.md (solo sección T{N})
- Archivos a leer: {lista EXACTA de archivos que necesita}
- Archivos a crear/modificar: {lista EXACTA}

## Criterio de aceptación
{Copiar del plan}

## Output
Escribir en: .forge/results/impl-T{N}.json

## Formato resultado
{
  "task": "T{N}",
  "status": "done | error | blocked",
  "files_changed": ["path/to/file.ts"],
  "commit": "abc1234",
  "commit_message": "feat: ...",
  "compilation": true,
  "notes": "cualquier observación"
}

## Reglas
- UN commit atómico para esta tarea
- NO modificar archivos fuera del scope listado
- Verificar compilación antes de commitear
- Si falla después de 2 intentos, reportar error
```

**Spawn:**

```bash
# Secuencial (tareas con dependencias)
chmod +x .claude/skills/forge/lib/spawn.sh
.claude/skills/forge/lib/spawn.sh .forge/tasks/impl-T1.md .forge/results/impl-T1.json 300

# Paralelo (tareas independientes)
.claude/skills/forge/lib/spawn.sh .forge/tasks/impl-T1.md .forge/results/impl-T1.json 300 &
.claude/skills/forge/lib/spawn.sh .forge/tasks/impl-T2.md .forge/results/impl-T2.json 300 &
wait
```

**Leer resultado** (solo el JSON, no el código):

```bash
cat .forge/results/impl-T1.json
```

Verificar status. Si `"error"` o `"blocked"` → decidir si reintentar o escalar.

**Progreso:**
```
BUILD: {feature}
═══════════════
Fase 2: Implementación

[✅] T1: Create payment model (abc1234) — 45s
[✅] T2: Add Stripe SDK config (def5678) — 32s
[🔄] T3: Implement checkout flow — spawned...
[⏳] T4: Webhook handler (waiting T3)
[⏳] T5: Tests

Context usage: ~8% (orquestador solo lee JSONs)
```

### Fase 3: Testing (aislado)

**Task file** `.forge/tasks/test-{slug}.md`:

```markdown
# Task: test-{slug}

## Tipo
test

## Objetivo
Generar tests y correr suite para los cambios del plan {slug}.

## Input
- Plan: .forge/plans/{slug}.md (sección de tests)
- Archivos implementados: {lista de archivos que se cambiaron, desde los results}
- Test framework: {detectado o desde config}
- Test command: {comando}

## Output
Escribir en: .forge/results/test-{slug}.json

## Formato resultado
{
  "status": "green | red",
  "total": 25,
  "passed": 23,
  "failed": 2,
  "coverage": {"lines": 87, "branches": 78},
  "failures": [
    {"test": "name", "file": "path:line", "error": "message", "source": "path:line"}
  ],
  "gaps": [
    {"file": "path", "lines": "range", "description": "qué falta"}
  ]
}
```

Leer resultado. Si `"red"` → Fase 3.5.

### Fase 3.5: Fix Loop (aislado, max 3 ciclos)

Para cada bug del test result:

**Task file** `.forge/tasks/fix-F{N}.md`:

```markdown
# Task: fix-F{N}

## Tipo
fix

## Objetivo
Arreglar bug: {test name} — {error message}

## Input
- Archivo con bug: {source_file}:{source_line}
- Test que falla: {test_file}:{test_line}
- Error: {error message completo}

## Output
Escribir en: .forge/results/fix-F{N}.json

## Formato resultado
{
  "bug": "F{N}",
  "status": "fixed | failed",
  "root_cause": "descripción de la causa raíz",
  "fix": "qué se cambió",
  "commit": "hash",
  "test_passes": true
}
```

Después de fixes → re-spawn test agent → leer resultado → loop si necesario.

```
Fix cycle: 1/3
  Fix F1 → spawned → done (fixed)
  Fix F2 → spawned → done (fixed)
  Re-test → spawned → result: GREEN ✅

  (o si RED → cycle 2/3 → ...)
```

**Máximo 3 ciclos.** Si después de 3 no está verde → escalar al usuario.

### Fase 4: Review (aislado)

**Task file** `.forge/tasks/review-{slug}.md`:

```markdown
# Task: review-{slug}

## Tipo
review

## Objetivo
Code review del branch actual contra {base}.

## Input
- Plan: .forge/plans/{slug}.md
- Diff: ejecutar git diff origin/{base}
- Config: .forge/config.yaml (confidence_gate)

## Output
Escribir en: .forge/results/review-{slug}.json

## Formato resultado
{
  "status": "clean | concerns | blocked",
  "plan_completion": {"done": 5, "partial": 1, "not_done": 0},
  "findings": [
    {"severity": "CRITICAL", "confidence": 9, "file": "path:line", "description": "..."}
  ],
  "summary": {"critical": 0, "high": 1, "medium": 2}
}
```

Si `"blocked"` (CRITICAL findings) → spawn fix agents → re-review (max 2 ciclos).
Si `"concerns"` → presentar al usuario.
Si `"clean"` → fase 5.

### Fase 5: Ship (interactivo)

El ship es INTERACTIVO porque el usuario debe aprobar el PR.
Ejecutar `/ship` normalmente.

## Estado Persistente

`.forge/builds/{slug}.json` — permite `/build --resume`:

```json
{
  "feature": "Add Stripe payments",
  "plan": ".forge/plans/stripe-payments.md",
  "branch": "feature/stripe-payments",
  "started_at": "ISO-8601",
  "phase": "implement",
  "tasks": {
    "T1": {"status": "done", "result": ".forge/results/impl-T1.json"},
    "T2": {"status": "done", "result": ".forge/results/impl-T2.json"},
    "T3": {"status": "in_progress", "task_file": ".forge/tasks/impl-T3.md"},
    "T4": {"status": "pending"}
  },
  "test_cycles": 0,
  "fix_cycles": 0,
  "review_status": null,
  "context_usage": {
    "orchestrator_tokens": "~2000",
    "workers_spawned": 4,
    "note": "Each worker used fresh context"
  }
}
```

## Resumen Final

```
BUILD COMPLETE: {feature} ✅
═══════════════════════════
Branch: feature/{slug}
PR: #{number}

Tareas: {N}/{N} completadas
Tests: {passed}/{total}, {coverage}% coverage
Review: CLEAN
Commits: {N}

Workers spawned: {M} (each with clean context)
Fix cycles: {K}
Total time: {duration}

No context window was harmed in the making of this feature. 🧠
```

## Reglas

- **El orquestador NO lee código/diffs.** Solo task files y result JSONs.
- **Cada worker es un proceso aislado.** Nace, trabaja, muere. Sin acumulación.
- **Task files son mínimos.** < 100 líneas, lista EXACTA de archivos a leer.
- **Result files son resúmenes.** < 50 líneas JSON, no código completo.
- **Paralelo cuando se puede.** Tareas independientes = spawns paralelos.
- **3 ciclos máximo por loop.** No loops infinitos.
- **Plan y ship son interactivos.** El humano aprueba el inicio y el final.
