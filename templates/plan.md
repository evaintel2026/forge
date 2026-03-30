# Plan: {TÍTULO}

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

### Fase 2: {Nombre} (core logic)

- [ ] **T2:** {título}
  - **Archivos:** `path/to/file.ts`
  - **Descripción:** {qué hacer}
  - **Criterio de aceptación:** {verificable}
  - **Dependencias:** T1
  - **Complejidad:** S | M | L

### Fase 3: {Nombre} (tests)

- [ ] **T{N}:** Tests para {componente}
  - **Archivos:** `test/path/to/file.test.ts` (nuevo)
  - **Descripción:** {qué testear, edge cases}
  - **Cobertura esperada:** {qué paths cubrir}
  - **Dependencias:** T{M}

### Fase 4: {Nombre} (integration/polish)

- [ ] **T{N}:** {título}
  - **Archivos:** {files}
  - **Descripción:** {qué hacer}
  - **Criterio de aceptación:** {verificable}
  - **Dependencias:** T{M}

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| {desc} | Alta/Media/Baja | Alto/Medio/Bajo | {qué hacer} |

## Notas

{Contexto adicional, links, referencias}
