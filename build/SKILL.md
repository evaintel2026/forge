---
name: build
version: 1.0.0
description: |
  Orquestador principal. Encadena plan → implement → test → fix → review → ship
  usando sub-agentes. El flujo completo en un comando.
  Use when: "build this", "construir", "implementar feature completa", "hazlo todo".
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

# /build — Orquestador del Flujo Completo

Eres el director de orquesta. Coordinas sub-agentes para ejecutar el flujo
completo: plan → implement → test → fix → review → ship.

## Invocación

- `/build "Add Stripe payment integration"` — flujo completo
- `/build --from issue #42` — desde un issue de GitHub
- `/build --resume` — continuar flujo interrumpido
- `/build --skip-plan` — saltar planificación (plan ya existe)
- `/build --dry-run` — solo planificar, no implementar

## Flujo Principal

```
┌─────────────────────────────────────────────────┐
│                    /build                         │
│                                                   │
│  1. /plan ──────→ Plan aprobado                   │
│                    │                              │
│  2. /implement ──→ Tasks T1..TN (sub-agentes)    │
│       │            │                              │
│       │   ┌────────┘                              │
│       │   ↓                                       │
│  3. /test ──────→ Suite verde?                    │
│       │            │                              │
│       │   NO ←─────┘                              │
│       │   │                                       │
│  4. /fix ───────→ Fix loop hasta verde            │
│       │            │                              │
│       │   ┌────────┘                              │
│       │   ↓                                       │
│  5. /review ────→ Clean?                          │
│       │            │                              │
│       │   NO ←─────┘                              │
│       │   │                                       │
│       │   /fix → /test → /review (loop)           │
│       │            │                              │
│       ↓   ┌────────┘                              │
│  6. /ship ──────→ PR creado ✅                    │
│                                                   │
└─────────────────────────────────────────────────┘
```

## Instrucciones

### Fase 1: Planificación

Ejecutar `/plan` con el request del usuario.

- Presentar plan al usuario
- **ESPERAR APROBACIÓN** — no continuar sin ok del usuario
- Si el usuario modifica el plan, guardar cambios

### Fase 2: Implementación

Para cada tarea del plan (respetando orden de dependencias):

**Tareas independientes → paralelo (sub-agentes):**
```
Si T1 y T2 no tienen dependencias entre sí:
  Sub-agente A: /implement T1
  Sub-agente B: /implement T2
  Esperar ambos
```

**Tareas con dependencias → secuencial:**
```
Si T3 depende de T1:
  Esperar T1 completado
  Sub-agente C: /implement T3
```

Después de cada batch de implementación:
1. Verificar que el proyecto compila
2. Correr tests existentes (regression check)
3. Si algo falla → `/fix` antes de continuar

**Progress reporting:**
```
BUILD: {feature}
═══════════════
Fase 2: Implementación

[✅] T1: Create payment model (abc1234)
[✅] T2: Add Stripe SDK config (def5678)
[🔄] T3: Implement checkout flow...
[⏳] T4: Webhook handler (waiting T3)
[⏳] T5: Tests
```

### Fase 3: Testing

Ejecutar `/test` para todo lo implementado.

- Si todo verde → fase 4
- Si hay fallos → fase 3.5

### Fase 3.5: Fix Loop

Ejecutar `/fix` para bugs encontrados.

```
Intento 1: /fix → /test
  ├─→ ✅ Todo verde → fase 4
  └─→ ❌ Fallos → Intento 2

Intento 2: /fix → /test
  ├─→ ✅ Todo verde → fase 4
  └─→ ❌ Fallos → Intento 3

Intento 3: /fix → /test
  ├─→ ✅ Todo verde → fase 4
  └─→ ❌ Fallos → ESCALAR al usuario
```

**Máximo 3 ciclos fix→test.** Si después de 3 no está verde, escalar:

```
BUILD: BLOCKED
═══════════════
3 ciclos de fix sin resolver todos los bugs.

Bugs persistentes:
  1. {descripción} — {qué intenté}
  2. {descripción} — {qué intenté}

Opciones:
  A) Yo investigo y te explico el problema en detalle
  B) Continuar review con bugs conocidos (no recomendado)
  C) Abortar build, mantener los commits que sí funcionan
```

### Fase 4: Review

Ejecutar `/review` del diff completo.

- Si CLEAN → fase 5
- Si CRITICAL findings → `/fix` → re-review (max 2 ciclos)
- Si solo HIGH/MEDIUM → presentar al usuario, preguntar si proceder

### Fase 5: Ship

Ejecutar `/ship`:
1. Generar changelog entry
2. Version bump (si configurado)
3. Crear PR
4. Presentar resumen final

### Estado Persistente

Guardar estado del build en `.forge/builds/{slug}.json`:

```json
{
  "feature": "Add Stripe payments",
  "plan": ".forge/plans/stripe-payments.md",
  "branch": "feature/stripe-payments",
  "started_at": "ISO-8601",
  "phase": "implement",
  "tasks": {
    "T1": { "status": "done", "commit": "abc1234" },
    "T2": { "status": "done", "commit": "def5678" },
    "T3": { "status": "in_progress" },
    "T4": { "status": "pending" }
  },
  "test_cycles": 0,
  "fix_cycles": 0,
  "review_status": null
}
```

Esto permite `/build --resume` si se interrumpe.

## Resumen Final

Al completar todo el flujo:

```
BUILD COMPLETE: {feature} ✅
═══════════════════════════
Branch: feature/{slug}
Plan: .forge/plans/{slug}.md
PR: #{number}

Tareas: {N}/{N} completadas
Tests: {passed}/{total} pasando, {coverage}% coverage
Review: CLEAN (0 critical, 0 high)
Commits: {N} ({M} implementation, {K} tests, {J} fixes)

Tiempo: {duration}
Fix cycles: {N}

Changelog entry added.
Ready to merge.
```

## Reglas

- **El usuario aprueba el plan.** No implementar sin aprobación.
- **Paralelo cuando se puede.** Tareas independientes van en paralelo.
- **3 ciclos máximo por loop.** Fix→test, fix→review. No loops infinitos.
- **Estado persistente.** Si se interrumpe, se puede continuar.
- **Transparencia total.** El usuario ve qué pasa en cada momento.
- **Escalar > insistir.** Si algo no sale después de 3 intentos, preguntar.
