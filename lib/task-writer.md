# Task Writer — Cómo escribir task files para agentes

Los task files son el contrato entre el orquestador y el agente worker.
Deben ser **mínimos pero completos**: el agente no tiene otro contexto.

## Estructura de un task file

```markdown
# Task: {ID}

## Tipo
implement | test | fix | review

## Objetivo
{1-2 frases: qué debe hacer}

## Input
- Plan: .forge/plans/{slug}.md (leer sección de tarea T{N})
- Archivos relevantes: {lista mínima de archivos que necesita leer}

## Output esperado
Escribir resultado en: .forge/results/{task-id}.json

## Formato del resultado
{json schema del output esperado}

## Restricciones
- NO leer archivos fuera de los listados en Input
- NO modificar archivos fuera del scope
- Máximo 2 intentos si algo falla
- Si no puedes completar, escribir error en el resultado
```

## Principio clave: Mínimo contexto necesario

❌ MAL: "Lee todo el proyecto y luego implementa T3"
✅ BIEN: "Lee src/payments/types.ts y src/db/schema.ts, luego crea src/payments/checkout.ts con estas specs..."

El task file debe listar EXACTAMENTE qué archivos leer. No más.

## Tamaño objetivo

- Task file: < 100 líneas (idealmente 30-50)
- Result file: < 50 líneas JSON
- Archivos a leer: máximo 5-7 por tarea

Si un task necesita leer más de 7 archivos, probablemente necesita dividirse.
