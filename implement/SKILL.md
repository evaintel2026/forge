---
name: implement
version: 1.0.0
description: |
  Implementa una tarea específica del plan con commit atómico. Diseñado para correr
  como sub-agente. Lee el plan, implementa la tarea, commitea, reporta.
  Use when: "implement T1", "implementar tarea", "build task".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
---

# /implement — Implementación de Tarea

Implementas UNA tarea del plan de forma atómica. Un commit, un propósito.

## Invocación

- `/implement T1` — implementar tarea T1 del plan activo
- `/implement T3 --plan payments` — tarea T3 del plan "payments"
- `/implement next` — siguiente tarea no completada del plan activo

## Instrucciones

### Paso 1: Cargar contexto

```bash
# Encontrar plan activo (el más reciente, o el especificado)
ls -t .forge/plans/*.md 2>/dev/null | head -1

# Branch actual
git branch --show-current

# Estado del working tree
git status --porcelain
```

Leer el plan completo. Encontrar la tarea especificada. Si el working tree está
sucio, PARAR: "Working tree sucio. Commitea o stashea antes de continuar."

### Paso 2: Analizar la tarea

De la tarea extraer:
- **Archivos a crear/modificar**
- **Descripción de qué hacer**
- **Criterio de aceptación**
- **Dependencias** — verificar que están completadas (marcadas con [x] en el plan)

Si una dependencia no está completada:
```
BLOCKED: T{N} depende de T{M} que no está completada.
Opciones: implementar T{M} primero, o continuar con otra tarea.
```

### Paso 3: Leer código existente

Antes de escribir código, leer:
1. Los archivos que vas a modificar (completos, no solo el diff)
2. Los archivos que importan/usan esos archivos (entender el contexto)
3. Tests existentes relacionados (para mantener consistencia)
4. Tipos/interfaces relevantes

Construir modelo mental del código antes de tocar nada.

### Paso 4: Implementar

Reglas de implementación:

1. **Seguir patrones existentes.** Si el proyecto usa X patrón, usar X. No inventar.
2. **Tipos primero.** Si es TypeScript/Go/Rust, definir tipos antes de lógica.
3. **Manejar errores.** No dejar happy-path only. Cada operación que puede fallar necesita manejo.
4. **Sin TODOs.** Si algo necesita hacerse, es una tarea en el plan. No dejar `// TODO` en el código.
5. **Imports ordenados.** Seguir convención del proyecto.
6. **Sin código muerto.** No comentar código viejo, eliminarlo.

### Paso 5: Verificación pre-commit

Antes de commitear, verificar:

```bash
# 1. Que compila/no tiene errores de sintaxis
# (adaptar al stack del proyecto)
npx tsc --noEmit 2>&1 | head -20          # TypeScript
python -m py_compile {file} 2>&1           # Python
go build ./... 2>&1 | head -20             # Go
cargo check 2>&1 | head -20               # Rust

# 2. Linter (si existe)
cat package.json 2>/dev/null | grep -q '"lint"' && npm run lint 2>&1 | tail -20

# 3. Tests existentes no se rompen
# (correr solo tests relacionados si es posible)
```

Si algo falla, arreglar antes de commitear. No commitear código que no compila.

### Paso 6: Commit atómico

```bash
git add {archivos-específicos}
git commit -m "{type}: {descripción concisa}

{Descripción más larga si es necesario}

Task: T{N}
Plan: {plan-slug}"
```

**Tipos de commit:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

### Paso 7: Actualizar plan

Marcar la tarea como completada en el plan:

```markdown
- [x] **T{N}:** {título}  ✅ {commit-hash-short}
```

```bash
git add .forge/plans/{slug}.md
git commit --amend --no-edit
```

### Paso 8: Reportar

Output:

```
IMPLEMENT: T{N} ✅
═══════════════════
Tarea: {título}
Archivos: {lista de archivos tocados}
Commit: {hash} — {message}
Compilación: ✅ | ❌ {error}
Lint: ✅ | ❌ | N/A
Tests existentes: ✅ pasando | ❌ {N} fallando | N/A

Siguiente: T{M} (siguiente tarea disponible)
```

## Modo sub-agente

Cuando `/implement` se invoca desde `/build`, corre como sub-agente:
- Sin interacción con el usuario
- Si algo falla, reportar el error y parar (no intentar arreglar sin contexto)
- El orquestador decide si re-intentar o escalar

## Reglas

- **UN commit por tarea.** No más, no menos.
- **No modificar archivos fuera del scope de la tarea.** Si ves algo que arreglar, es otra tarea.
- **No inventar features.** Implementar exactamente lo que dice el plan.
- **Si la tarea es ambigua, PARAR.** Mejor preguntar que asumir.
- **Verificar antes de commitear.** Código que no compila no se commitea nunca.
