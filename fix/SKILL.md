---
name: fix
version: 1.0.0
description: |
  Toma bugs del test o review, los arregla con commits atómicos, y re-testea.
  Loop automático: fix → test → fix hasta verde. Sub-agente.
  Use when: "fix bugs", "arreglar", "fix the failures".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# /fix — Bug Fix Loop

Arreglas bugs identificados por `/test` o `/review`. Un fix, un commit, re-test.
Loop hasta verde.

## Invocación

- `/fix` — arreglar todos los bugs del último test/review report
- `/fix --report test-20240315.json` — bugs de un reporte específico
- `/fix F1` — arreglar un bug específico
- `/fix --max-attempts 3` — máximo intentos por bug (default: 3)

## Instrucciones

### Paso 1: Cargar bugs

```bash
# Último reporte de test o review
ls -t .forge/reports/test-*.json .forge/reports/review-*.json 2>/dev/null | head -1
```

Extraer lista de bugs/findings clasificados como "bug_in_code" o CRITICAL/HIGH.

### Paso 2: Priorizar

Orden de fix:
1. **CRITICAL** — bugs de seguridad, data loss, crashes
2. **HIGH** — funcionalidad rota, test failures
3. **MEDIUM** — comportamiento incorrecto no-crítico

### Paso 3: Fix loop (por cada bug)

```
┌─→ Leer el bug (error, file, line)
│   │
│   ├─→ Leer archivo completo + tests relacionados
│   │
│   ├─→ Diagnosticar causa raíz (no el síntoma)
│   │
│   ├─→ Implementar fix mínimo
│   │
│   ├─→ Correr test que fallaba
│   │   │
│   │   ├─→ ✅ PASA → commit + siguiente bug
│   │   │
│   │   └─→ ❌ FALLA → intento N+1
│   │       │
│   │       ├─→ N < max_attempts → volver arriba
│   │       │
│   │       └─→ N >= max_attempts → ESCALAR
│   │
└───┘
```

**Reglas del fix:**
- **Fix mínimo.** Cambiar lo menos posible. No refactorear durante un fix.
- **Causa raíz.** Si el test falla por null en línea 42, buscar POR QUÉ es null, no poner un `if (x != null)`.
- **No romper otros tests.** Después del fix, correr la suite completa.
- **Cada fix = un commit.**

```bash
git add {archivos}
git commit -m "fix: {qué se arregla}

Bug: {descripción del bug}
Root cause: {causa raíz}
Test: {nombre del test que ahora pasa}
Report: {report-file}"
```

### Paso 4: Re-test completo

Después de todos los fixes, correr la suite completa:

```bash
{test_command} 2>&1
```

Si hay nuevos fallos (regresiones del fix):
- Volver al loop
- Si el fix de A rompe B, es señal de acoplamiento → notar en el reporte

### Paso 5: Reportar

```
FIX: {N} bugs resueltos
═══════════════════════
✅ F1: SQL injection en queries.ts:42 — parametrized query (abc1234)
✅ F2: Auth bypass en middleware.ts:15 — added auth check (def5678)
⚠️ F3: Race condition en cache.ts:78 — ESCALADO (3 intentos fallidos)

Re-test: {passed}/{total} pasando
Regresiones: 0 | {N} (detallar)

Siguiente: /review (si hubo fixes) | /ship (si todo verde)
```

## Escalation

Si después de `max_attempts` intentos no se resuelve:

```
ESCALADO: Bug F{N}
══════════════════
Bug: {descripción}
Intentos: {N}/{max}
Lo que probé:
  1. {intento 1} — {por qué falló}
  2. {intento 2} — {por qué falló}
  3. {intento 3} — {por qué falló}
Diagnóstico: {mi hipótesis de la causa raíz}
Sugerencia: {qué haría un humano}
```

No seguir intentando. Es mejor escalar que crear más problemas.

## Reglas

- **3 intentos máximo por bug.** Si no lo arreglas en 3, necesitas un humano.
- **Fix mínimo.** No es momento de refactorear.
- **No silenciar tests.** Nunca "arreglar" un bug skipeando o borrando el test.
- **Regresión = prioridad máxima.** Si tu fix rompe algo, arréglalo antes de seguir.
- **Documenta la causa raíz.** El commit message debe explicar el POR QUÉ, no solo el QUÉ.
