---
name: plan
version: 1.0.0
description: |
  Analiza un repositorio y genera un plan de implementación estructurado con checklist
  de tareas, dependencias, y criterios de aceptación. Punto de entrada del flujo forge.
  Use when: "plan this", "planificar", "qué necesitamos hacer", "diseña la feature".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
---

# /plan — Planificación de Feature

Generas planes de implementación detallados y accionables. Cada plan se convierte
en el contrato que guía `/implement`, `/test`, y `/review`.

## Invocación

- `/plan "Add Stripe payment integration"` — plan para una feature nueva
- `/plan --from issue #42` — plan basado en un issue de GitHub
- `/plan --refactor auth` — plan para refactoring
- `/plan --bugfix "login fails on Safari"` — plan para fix de bug

## Instrucciones

### Paso 1: Reconocimiento del Proyecto

Antes de planificar, entender qué existe.

```bash
# Detectar stack
ls package.json tsconfig.json Gemfile requirements.txt pyproject.toml go.mod Cargo.toml 2>/dev/null

# Estructura del proyecto
find . -maxdepth 3 -type f -name '*.ts' -o -name '*.py' -o -name '*.rb' -o -name '*.go' -o -name '*.rs' 2>/dev/null | head -50

# Tests existentes
find . -name '*.test.*' -o -name '*.spec.*' -o -name '*_test.*' 2>/dev/null | head -20

# Config de forge si existe
cat .forge/config.yaml 2>/dev/null

# README y docs
cat README.md 2>/dev/null | head -50

# Git: últimos cambios
git log --oneline -20 2>/dev/null
```

Leer archivos clave: README.md, estructura de directorios, configuración del proyecto.
Construir un modelo mental de la arquitectura antes de seguir.

### Paso 2: Análisis del Scope

Dado el request del usuario:

1. **Identificar componentes afectados** — qué archivos/módulos se tocan
2. **Detectar dependencias** — qué necesita existir antes de implementar
3. **Estimar complejidad** — S/M/L/XL por tarea
4. **Identificar riesgos** — qué puede salir mal, qué no conocemos

### Paso 3: Generar Plan

Crear el archivo de plan en `.forge/plans/{slug}.md`:

```bash
mkdir -p .forge/plans
```

El plan debe seguir esta estructura exacta:

```markdown
# Plan: {Título}

**Fecha:** {YYYY-MM-DD}
**Branch:** {feature-branch-name}
**Complejidad:** S | M | L | XL
**Estimación:** ~{N} tareas, ~{M} horas con AI

## Contexto

{1-3 párrafos: qué se pide, por qué, qué existe hoy}

## Decisiones de Arquitectura

- **D1:** {decisión} — porque {razón}
- **D2:** {decisión} — porque {razón}

## Tareas

### Fase 1: {Nombre} (setup/foundation)

- [ ] **T1:** {título}
  - **Archivos:** `path/to/file.ts` (nuevo | modificar)
  - **Descripción:** {qué hacer exactamente}
  - **Criterio de aceptación:** {cómo saber que está bien}
  - **Dependencias:** ninguna | T{N}
  - **Complejidad:** S | M | L

- [ ] **T2:** {título}
  ...

### Fase 2: {Nombre} (core logic)

- [ ] **T3:** {título}
  ...

### Fase 3: {Nombre} (tests)

- [ ] **T{N}:** Tests para {componente}
  - **Archivos:** `test/path/to/file.test.ts` (nuevo)
  - **Descripción:** {qué testear, qué edge cases}
  - **Cobertura esperada:** {qué paths cubrir}
  - **Dependencias:** T{M}

### Fase 4: {Nombre} (integration/polish)

- [ ] **T{N}:** {título}
  ...

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| {desc} | Alta/Media/Baja | Alto/Medio/Bajo | {qué hacer} |

## Notas

{Cualquier contexto adicional, links, referencias}
```

### Paso 4: Validación

Antes de guardar, verificar:

1. ¿Cada tarea es lo suficientemente pequeña para un commit atómico?
2. ¿Las dependencias forman un DAG (sin ciclos)?
3. ¿Hay tests para cada componente de lógica?
4. ¿Los criterios de aceptación son verificables?
5. ¿Los archivos listados existen (para modificar) o el path es correcto (para nuevos)?

Si una tarea es demasiado grande (>100 líneas de cambio estimadas), dividirla.

### Paso 5: Presentar al usuario

Mostrar resumen del plan:

```
PLAN: {título}
══════════════
Complejidad: {S/M/L/XL}
Tareas: {N} total ({X} implementación, {Y} tests, {Z} config)
Fases: {N}
Riesgos: {N} identificados

Archivo: .forge/plans/{slug}.md
```

Preguntar si quiere:
- A) Aprobar y empezar implementación (`/implement` o `/build`)
- B) Modificar algo del plan
- C) Más detalle en alguna tarea

### Paso 6: Crear branch

Si el usuario aprueba:

```bash
git checkout -b {branch-name}
git add .forge/plans/{slug}.md
git commit -m "plan: {título}"
```

## Reglas

- **Un plan = un feature/fix/refactor.** No mezclar scopes.
- **Tareas atómicas.** Si no cabe en un commit, es demasiado grande.
- **Tests son tareas.** No son opcionales, son parte del plan.
- **Criterios verificables.** "Funciona bien" no es un criterio. "Retorna 200 con payload válido" sí.
- **El plan es el contrato.** `/review` va a cruzar el diff contra este plan.
