# 🔨 Forge — Engineering Workflow for Claude Code

Un sistema de skills para Claude Code que orquesta el ciclo completo de desarrollo:
análisis → planificación → implementación → testing → review → fix → ship.

## Flujo

```
/plan → /arch → /implement → /test → /review → /fix → /ship
  ↑                                                      |
  └──────────────── /retro ←──────────────────────────────┘
```

O el atajo que lo hace todo:

```
/build "Add Stripe payments"
```

## Skills

| Comando | Función | Tipo |
|---------|---------|------|
| `/plan` | Analiza repo, genera plan con checklist de tareas | Interactivo |
| `/arch` | Revisa arquitectura, documenta decisiones, define interfaces | Interactivo |
| `/implement` | Toma 1 tarea del plan, la implementa con commit atómico | Sub-agente |
| `/test` | Genera tests, corre suite, reporta coverage | Sub-agente |
| `/review` | Code review automático (SQL, security, scope drift) | Interactivo |
| `/fix` | Toma bugs del test/review, arregla y re-testea | Sub-agente loop |
| `/ship` | PR, changelog, version bump | Interactivo |
| `/cso` | Security audit (OWASP, STRIDE, secrets, supply chain) | Interactivo |
| `/build` | Orquestador: encadena todo el flujo con sub-agentes | Orquestador |

## Instalación

```bash
# Clonar en skills de Claude Code
git clone https://github.com/evaintel2026/forge.git ~/.claude/skills/forge

# O copiar a un proyecto específico
cp -r forge/ .claude/skills/forge/
```

## Hooks de Git

```bash
# Instalar hooks
cp ~/.claude/skills/forge/hooks/pre-commit .git/hooks/pre-commit
cp ~/.claude/skills/forge/hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-commit .git/hooks/pre-push
```

## Configuración por proyecto

Crear `.forge/config.yaml` en la raíz del proyecto:

```yaml
# .forge/config.yaml
project:
  name: mi-proyecto
  language: typescript  # typescript | python | rust | go | ruby
  framework: nextjs     # nextjs | express | fastapi | django | rails

testing:
  command: "bun test"
  coverage: true
  min_coverage: 80

review:
  confidence_gate: 8    # 1-10, findings debajo de esto se filtran
  security_scan: true

ship:
  require_tests: true
  require_review: true
  changelog: true
  version_bump: patch   # patch | minor | major | auto
```

## Principios

1. **Lean** — Skills de ~200-500 líneas. Sin bloat, sin telemetría, sin onboarding.
2. **Composable** — Cada skill funciona solo o encadenado.
3. **Atomic** — Un commit por tarea/fix. Revertible.
4. **Loop hasta verde** — implement → test → fix es un ciclo, no un paso.
5. **Documentado** — Cada decisión queda en el plan. Cada fix queda en el commit.

## Estructura de archivos generados

```
.forge/
├── config.yaml          # Configuración del proyecto
├── plans/
│   └── {feature}.md     # Planes generados por /plan
├── reports/
│   ├── test-*.json      # Reportes de test
│   ├── review-*.json    # Reportes de review
│   └── security-*.json  # Reportes de /cso
└── changelog.md         # Changelog auto-generado
```

## Créditos

Metodologías de review, QA y security inspiradas en [gstack](https://github.com/garrytan/gstack) (MIT License).

## Licencia

MIT
