---
name: review
version: 1.0.0
description: |
  Code review automático pre-merge. Cruza diff contra plan, analiza SQL safety,
  security, scope drift, test coverage, y calidad general.
  Use when: "review", "code review", "revisa el PR", "check my diff".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
---

# /review — Code Review Automático

Revisas el diff como un senior engineer escéptico. Buscas bugs reales,
no formateo. Cada finding tiene confidence score y evidence.

## Invocación

- `/review` — review del branch actual vs base
- `/review --plan payments` — review cruzando contra plan específico
- `/review --diff-only` — solo diff, sin cruzar contra plan
- `/review --security` — enfocado en security (mini /cso)

## Instrucciones

### Paso 1: Setup

```bash
# Base branch
BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo "main")
git fetch origin $BASE --quiet

# Branch actual
BRANCH=$(git branch --show-current)

# Diff stats
git diff origin/$BASE --stat
git diff origin/$BASE --numstat

# Plan activo (si existe)
ls -t .forge/plans/*.md 2>/dev/null | head -1
```

### Paso 2: Plan Completion Audit

Si hay plan activo, cruzar diff contra plan:

1. **Extraer tareas del plan** — todos los items `- [ ]` y `- [x]`
2. **Cruzar contra diff** — para cada tarea:
   - `DONE` — evidencia clara en el diff
   - `PARTIAL` — algo hecho pero incompleto
   - `NOT DONE` — sin evidencia
   - `CHANGED` — hecho de forma diferente al plan

3. **Detectar scope drift:**
   - Archivos en el diff que no están en ninguna tarea → scope creep
   - Tareas del plan sin evidencia en el diff → requirements missing

```
PLAN COMPLETION
═══════════════
Plan: .forge/plans/{slug}.md

✅ DONE:     T1, T3, T5
🔶 PARTIAL:  T4 (modelo creado, controller falta)
❌ NOT DONE: T6, T7
🔄 CHANGED:  T2 (Redis → in-memory cache)

Scope: CLEAN | DRIFT (3 archivos fuera de plan)
Completion: 5/7 tareas (71%)
```

### Paso 3: Two-Pass Review

**Pass 1 — CRITICAL (bugs que rompen cosas):**

Para cada archivo en el diff, leer el archivo COMPLETO (no solo el hunk):

| Categoría | Qué buscar | Ejemplo |
|-----------|-----------|---------|
| **SQL Safety** | String interpolation en queries, raw SQL sin parametrizar | `query("SELECT * FROM users WHERE id = " + id)` |
| **Auth/AuthZ** | Endpoints sin auth, IDOR, privilege escalation | Ruta sin middleware de auth |
| **Race Conditions** | Read-modify-write sin lock, double-submit | Check-then-act sin atomicidad |
| **Data Loss** | Deletes sin soft-delete, migrations destructivas | `DROP COLUMN` sin backup |
| **Secret Exposure** | Hardcoded keys, secrets en logs, .env commiteado | `apiKey = "sk-..."` |
| **Injection** | Command injection, template injection, XSS | `exec(userInput)` |

**Pass 2 — INFORMATIONAL (mejoras, no blockers):**

| Categoría | Qué buscar |
|-----------|-----------|
| **Error Handling** | catch vacíos, errores silenciados, falta de retry |
| **Performance** | N+1 queries, falta de índices, bundle size |
| **Dead Code** | Código comentado, imports sin uso, funciones no llamadas |
| **Naming** | Variables ambiguas, funciones que no dicen qué hacen |
| **Test Gaps** | Código sin test, paths no cubiertos |
| **Types** | `any` en TypeScript, casts inseguros |

### Paso 4: Confidence Scoring

Cada finding DEBE tener score de confianza:

| Score | Significado | Acción |
|-------|------------|--------|
| 9-10 | Verificado leyendo código. Bug concreto. | Reportar |
| 7-8 | Pattern match de alta confianza. Muy probable. | Reportar |
| 5-6 | Posible issue. Podría ser falso positivo. | Reportar con caveat |
| 3-4 | Sospechoso pero probablemente ok. | Solo en apéndice |
| 1-2 | Especulación. | No reportar |

**Gate:** Solo reportar findings con confidence ≥ del `confidence_gate` en config (default: 8).

Formato: `[SEVERITY] (confidence: N/10) file:line — descripción`

### Paso 5: False Positive Filtering

**Auto-descartar:**
- Vulnerabilities en tests/fixtures (no es código de producción)
- React/Angular/Vue escapan XSS por default (solo flaggear escape hatches)
- Environment variables son trusted input
- UUIDs son unguessable (no flaggear falta de validación)
- Docker configs para dev local con localhost
- Código de ejemplo en docs/README
- `any` en archivos de test
- Imports de tipo-only en TypeScript

**Nunca descartar:**
- SQL injection con input de usuario
- Secrets hardcodeados (aunque sea "temporal")
- Auth bypass
- Data loss potencial

### Paso 6: Generar Reporte

Guardar en `.forge/reports/review-{timestamp}.json`:

```json
{
  "timestamp": "ISO-8601",
  "branch": "feature/payments",
  "base": "main",
  "plan": "payments",
  "plan_completion": {
    "done": 5, "partial": 1, "not_done": 2, "changed": 1,
    "scope": "clean"
  },
  "findings": [
    {
      "id": 1,
      "severity": "CRITICAL",
      "confidence": 9,
      "category": "SQL Safety",
      "file": "src/db/queries.ts",
      "line": 42,
      "description": "String interpolation en SQL query",
      "evidence": "const q = `SELECT * FROM users WHERE email = '${email}'`",
      "recommendation": "Usar parametrized query: db.query('SELECT * FROM users WHERE email = $1', [email])"
    }
  ],
  "summary": {
    "critical": 1, "high": 2, "medium": 3, "informational": 5,
    "filtered_fp": 8
  }
}
```

Output al usuario:

```
REVIEW: {branch}
════════════════
Plan completion: 5/7 (71%) — 1 partial, 2 not done
Scope: CLEAN | DRIFT

FINDINGS:
  [CRIT] (9/10) src/db/queries.ts:42 — SQL injection via string interpolation
  [HIGH] (8/10) src/auth/middleware.ts:15 — Endpoint /api/admin sin auth check
  [MED]  (7/10) src/payments/stripe.ts:89 — Error silenciado en catch vacío

INFORMATIONAL:
  [INFO] src/utils/format.ts:12 — Variable 'x' podría tener mejor nombre
  [INFO] src/payments/webhook.ts — Sin tests

Filtered: 8 false positives descartados
Reporte: .forge/reports/review-{timestamp}.json

VERDICT: ❌ BLOCK (1 critical) | ⚠️ PASS WITH CONCERNS | ✅ CLEAN
```

### Paso 7: Acción post-review

Si hay CRITICAL findings:
- Sugerir `/fix` para cada uno
- No recomendar merge hasta que se resuelvan

Si hay HIGH findings:
- Listar como "resolver antes de merge o aceptar riesgo"

Si está limpio:
- Recomendar `/ship`

## Reglas

- **Leer el archivo completo, no solo el diff.** El contexto importa.
- **Evidence obligatoria.** Sin evidencia no hay finding.
- **No flaggear estilo.** Un code review no es un linter.
- **Think like an attacker.** ¿Cómo abusaría esto un usuario malicioso?
- **Reconocer buen código.** Si algo está bien hecho, decirlo. No solo buscar problemas.
