---
name: test
version: 1.0.0
description: |
  Genera tests para código implementado, corre la suite, reporta coverage y gaps.
  Diseñado para correr como sub-agente después de /implement.
  Use when: "test this", "generar tests", "run tests", "coverage".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# /test — Testing & Coverage

Generas tests, corres la suite, y reportas coverage con gaps identificados.

## Invocación

- `/test` — testear todos los cambios del branch actual vs base
- `/test T1 T2 T3` — testear tareas específicas del plan
- `/test --file src/payments.ts` — testear un archivo específico
- `/test --regression` — solo correr suite existente, verificar que nada se rompió

## Instrucciones

### Paso 1: Detectar framework de testing

```bash
# Detectar framework
cat package.json 2>/dev/null | grep -E '"jest"|"vitest"|"mocha"|"playwright"|"cypress"'
ls jest.config.* vitest.config.* pytest.ini .rspec 2>/dev/null
ls -d test/ tests/ spec/ __tests__/ e2e/ 2>/dev/null

# Detectar comando de test
cat package.json 2>/dev/null | grep -A1 '"test"'
cat Makefile 2>/dev/null | grep -E '^test:'

# Config de forge
cat .forge/config.yaml 2>/dev/null | grep -A3 'testing:'
```

Si no hay framework: reportar y sugerir uno basado en el stack.

### Paso 2: Identificar qué testear

Obtener diff contra base branch:

```bash
BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo "main")
git diff origin/$BASE --name-only
```

Para cada archivo cambiado:
1. **Leer el archivo completo** (no solo el diff)
2. **Trazar data flow:** entrada → transformación → salida → side effects
3. **Mapear branches:** cada if/else, switch, try/catch, guard clause, early return
4. **Identificar edge cases:** null, vacío, máximo, tipos inválidos, concurrent

### Paso 3: Generar tests

Para cada archivo/componente que necesita tests:

**Estructura de test:**

```typescript
describe('{Componente}', () => {
  // Setup compartido
  beforeEach(() => { ... });

  describe('{función/método}', () => {
    // Happy path
    it('should {comportamiento esperado} when {condición}', () => { ... });

    // Edge cases
    it('should handle empty input', () => { ... });
    it('should handle null/undefined', () => { ... });
    it('should throw on invalid {param}', () => { ... });

    // Error paths
    it('should {manejar error} when {falla}', () => { ... });
  });
});
```

**Reglas de naming:**
- `should {verbo} when {condición}` — siempre
- Describir comportamiento, no implementación
- Un assert lógico por test (pueden ser múltiples expects si verifican lo mismo)

**Qué testear (prioridad):**
1. ✅ Lógica de negocio (cálculos, transformaciones, validaciones)
2. ✅ Error handling (qué pasa cuando falla)
3. ✅ Edge cases (null, vacío, límites, tipos incorrectos)
4. ✅ Integración entre componentes que cambiaron
5. ⚠️ Side effects (DB writes, API calls — mockear)
6. ❌ No testear: getters triviales, tipos de TypeScript, UI layout puro

### Paso 4: Correr tests

```bash
# Correr suite completa
{test_command} 2>&1

# Si hay coverage disponible
{test_command} --coverage 2>&1
```

Capturar:
- Tests pasando / fallando / skipped
- Coverage por archivo (si disponible)
- Tiempo de ejecución
- Errores y stack traces de failures

### Paso 5: Analizar resultados

Para cada test fallando:
1. **Leer el error** completo (no truncar)
2. **Clasificar:** bug en código | bug en test | test flaky | config issue
3. **Si es bug en código:** crear entry para `/fix`
4. **Si es bug en test:** arreglar el test directamente

### Paso 6: Coverage analysis

```
TEST COVERAGE
═════════════
Archivo                          Líneas  Branches  Funciones
src/payments/stripe.ts           92%     85%       100%
src/payments/webhook.ts          78%     60%       90%     ⚠️
src/utils/validation.ts          100%    100%      100%    ✅

GAPS IDENTIFICADOS:
- stripe.ts:45-52 — branch de error en refund (no testeado)
- webhook.ts:23 — switch case "dispute" (no testeado)
- webhook.ts:67-80 — catch block de signature verification

OVERALL: 87% líneas, 78% branches
```

### Paso 7: Commit tests

```bash
git add {archivos-de-test}
git commit -m "test: {qué se testea}

Coverage: {N}% lines, {M}% branches
Tasks: T{X}, T{Y}
Plan: {plan-slug}"
```

### Paso 8: Generar reporte

Guardar en `.forge/reports/test-{timestamp}.json`:

```json
{
  "timestamp": "ISO-8601",
  "plan": "{slug}",
  "tasks_tested": ["T1", "T2"],
  "results": {
    "total": 25,
    "passed": 23,
    "failed": 2,
    "skipped": 0,
    "duration_ms": 3400
  },
  "coverage": {
    "lines": 87,
    "branches": 78,
    "functions": 95
  },
  "failures": [
    {
      "test": "should handle expired token",
      "file": "test/auth.test.ts:42",
      "error": "Expected 401, got 500",
      "classification": "bug_in_code",
      "source_file": "src/auth.ts",
      "source_line": 67
    }
  ],
  "gaps": [
    {
      "file": "src/webhook.ts",
      "lines": "67-80",
      "description": "catch block no testeado"
    }
  ]
}
```

Output al usuario:

```
TEST: {plan} ✅ | ❌
══════════════════
Resultado: {passed}/{total} pasando ({failed} fallando)
Coverage: {lines}% líneas, {branches}% branches
Duración: {time}s

{Si hay failures:}
BUGS ENCONTRADOS:
  1. {test}: {error} → {source_file}:{line}
  2. ...

Reporte: .forge/reports/test-{timestamp}.json
Siguiente: /fix (si hay bugs) | /review (si todo verde)
```

## Reglas

- **Tests son código de producción.** Misma calidad, mismos estándares.
- **No mockear todo.** Mock solo lo que es externo (DB, APIs, filesystem). La lógica se testea real.
- **Un assert lógico por test.** Más fácil de debuggear cuando falla.
- **Tests deterministas.** Sin dependencia de hora, random, orden de ejecución.
- **Si el test es más complejo que el código, algo está mal.**
