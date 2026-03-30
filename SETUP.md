# Integrar Forge en un proyecto existente

## Principio: cero impacto en lo que ya funciona

Forge se instala como un skill más de Claude Code. No modifica:
- Tu código fuente
- Tu CLAUDE.md existente (solo agrega una sección)
- Tus hooks de git (solo agrega los suyos si no existen)
- Tu workflow actual (los skills son opt-in)

Todo lo que forge genera va en `.forge/` (gitignoreable).

---

## Método 1: Como skill global (todos tus proyectos)

```bash
# Clonar en el directorio de skills de Claude Code
git clone https://github.com/evaintel2026/forge.git ~/.claude/skills/forge
```

Listo. Claude Code descubre automáticamente los skills en `~/.claude/skills/`.
Ya puedes usar `/plan`, `/build`, `/review`, etc. en cualquier proyecto.

**No toca nada del proyecto.** Solo vive en tu home.

---

## Método 2: Como skill del proyecto (para el equipo)

```bash
# Desde la raíz de tu proyecto
mkdir -p .claude/skills
git clone https://github.com/evaintel2026/forge.git .claude/skills/forge
rm -rf .claude/skills/forge/.git  # desacoplar del repo de forge

# Agregar al .gitignore (archivos generados por forge)
echo "" >> .gitignore
echo "# Forge" >> .gitignore
echo ".forge/" >> .gitignore
```

Luego agregar una sección al CLAUDE.md del proyecto (ver abajo).

---

## Qué agregar al CLAUDE.md (opcional pero recomendado)

Si tu proyecto ya tiene CLAUDE.md, **agregar al final** (no reemplazar nada):

```markdown
## Forge — Engineering Workflow

Skills disponibles: /plan, /arch, /implement, /test, /review, /fix, /ship, /cso, /build

Routing:
- "planificar", "plan this" → /plan
- "implementar", "build this" → /build
- "code review", "review" → /review
- "testear", "test this" → /test
- "security audit" → /cso
- "ship", "deploy", "crear PR" → /ship

Archivos generados en .forge/ (gitignored).
```

**Si NO tienes CLAUDE.md:** forge funciona igual, solo que Claude no hará routing
automático. Tendrás que invocar los skills explícitamente (`/plan`, `/build`, etc.).

---

## Qué pasa con tu workflow actual

### Si ya tienes hooks de git:
Forge NO sobreescribe hooks. Los hooks de forge están en `forge/hooks/` como
referencia. Puedes:
- Ignorarlos completamente
- Copiar solo las partes que te interesen a tus hooks existentes
- Encadenarlos: tu hook llama al de forge al final

### Si ya tienes testing configurado:
Forge detecta automáticamente tu framework de testing (jest, vitest, pytest, etc.)
y usa TU comando de test. No instala ni configura nada extra.

### Si ya tienes CI/CD:
Forge no toca CI/CD. Todo es local. Los reportes van a `.forge/reports/` que está
gitignored.

### Si ya tienes code review (Greptile, CodeRabbit, etc.):
`/review` complementa, no reemplaza. Puedes usar ambos.

---

## Archivos que forge genera

Todo va en `.forge/` en la raíz del proyecto:

```
.forge/
├── config.yaml          # Config (tú la creas, opcional)
├── plans/               # Planes generados por /plan
├── tasks/               # Task files para sub-agentes
├── results/             # Resultados de sub-agentes
├── builds/              # Estado de /build (resume)
├── reports/             # Reportes de test/review/security
├── adrs/                # Architecture Decision Records
├── changelog.md         # Changelog generado por /ship
├── .browser-state.json  # Estado del browser (nivel 1)
└── .daemon-state.json   # Estado del daemon (nivel 2)
```

**Recomendación:** agregar `.forge/` al `.gitignore`. Los planes y ADRs puedes
commitearlos selectivamente si quieres compartirlos con el equipo.

---

## Desinstalación

```bash
# Método 1 (global)
rm -rf ~/.claude/skills/forge

# Método 2 (proyecto)
rm -rf .claude/skills/forge
# Quitar la sección "Forge" del CLAUDE.md
# Quitar ".forge/" del .gitignore
```

Los archivos en `.forge/` quedan (son tuyos). Bórralos si quieres:
```bash
rm -rf .forge/
```

---

## Quick start para un proyecto existente

```bash
# 1. Instalar (global, 5 segundos)
git clone https://github.com/evaintel2026/forge.git ~/.claude/skills/forge

# 2. Abrir Claude Code en tu proyecto

# 3. Probar
/plan "Describe what you want to build or improve"

# 4. Si te convence
/build "Actually build it"
```

Eso es todo. No hay config obligatoria, no hay setup, no hay onboarding de 15 pasos.
