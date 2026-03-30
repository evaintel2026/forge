---
name: ship
version: 1.0.0
description: |
  Workflow de shipping: merge base, changelog, version bump, PR, deploy.
  Paso final del flujo forge.
  Use when: "ship", "deploy", "crear PR", "push", "merge".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# /ship — Ship It

Último paso. Empaquetas todo y creas el PR con changelog y version bump.

## Invocación

- `/ship` — ship branch actual
- `/ship --no-bump` — sin version bump
- `/ship --draft` — PR como draft

## Pre-flight Checks

Antes de hacer nada, verificar que todo está en orden:

```bash
# 1. Working tree limpio
git status --porcelain

# 2. Branch no es main/master
BRANCH=$(git branch --show-current)
BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo "main")
[ "$BRANCH" = "$BASE" ] && echo "ERROR: Estás en $BASE. Crea un branch primero." && exit 1

# 3. Tests pasan
# (detectar y correr comando de test del proyecto)

# 4. Último review (si existe)
ls -t .forge/reports/review-*.json 2>/dev/null | head -1
```

**Blockers (no continuar):**
- Working tree sucio
- En branch base (main/master)
- Tests fallan
- Review con findings CRITICAL sin resolver

**Warnings (continuar con nota):**
- No hay review reciente → "⚠️ No se encontró review. Considera correr /review primero."
- Review con HIGH findings → "⚠️ {N} findings HIGH sin resolver."

## Instrucciones

### Paso 1: Merge base branch

```bash
git fetch origin $BASE --quiet
git merge origin/$BASE --no-edit
```

Si hay conflictos: resolverlos, commitear el merge.

### Paso 2: Changelog

Leer o crear `.forge/changelog.md`:

```bash
cat .forge/changelog.md 2>/dev/null || echo "# Changelog" > .forge/changelog.md
```

Generar entry basada en los commits del branch:

```bash
git log origin/$BASE..HEAD --oneline --no-merges
```

Formato de entry:

```markdown
## [{version}] — {YYYY-MM-DD}

### Added
- {features nuevas}

### Fixed
- {bugs arreglados}

### Changed
- {cambios en funcionalidad existente}
```

Insertar después del header `# Changelog`.

### Paso 3: Version bump (si configurado)

Leer versión actual:

```bash
# package.json
cat package.json 2>/dev/null | grep '"version"'
# VERSION file
cat VERSION 2>/dev/null
# pyproject.toml
cat pyproject.toml 2>/dev/null | grep '^version'
```

Bump según config (.forge/config.yaml → `ship.version_bump`):
- `patch`: 1.2.3 → 1.2.4
- `minor`: 1.2.3 → 1.3.0
- `major`: 1.2.3 → 2.0.0
- `auto`: patch para fixes, minor para features, major para breaking changes

Commitear bump:

```bash
git add {version-file} .forge/changelog.md
git commit -m "chore: release v{version}"
```

### Paso 4: Push & PR

```bash
git push origin $BRANCH

# Crear PR (GitHub)
gh pr create \
  --title "{tipo}: {descripción}" \
  --body "$(cat <<'EOF'
## Descripción
{resumen del cambio}

## Plan
{link al plan: .forge/plans/{slug}.md}

## Cambios
{lista de cambios principales}

## Testing
- Tests: {passed}/{total} pasando
- Coverage: {N}%
- Review: {status}

## Checklist
- [ ] Tests pasan
- [ ] Review limpio
- [ ] Changelog actualizado
- [ ] Version bump
EOF
)" \
  --base $BASE
```

### Paso 5: Resumen

```
SHIPPED: v{version} 🚀
═══════════════════════
Branch: {branch}
PR: #{number} — {url}
Base: {base}

Commits: {N} total
  - {M} features
  - {K} fixes
  - {J} tests
  - {L} chore

Changelog: .forge/changelog.md
Version: {old} → {new}

Tests: ✅ {passed}/{total}
Review: ✅ CLEAN | ⚠️ {N} warnings

Ready for merge.
```

## Reglas

- **No ship sin tests verdes.** Nunca.
- **No ship main directo.** Siempre PR.
- **Changelog obligatorio.** Aunque sea una línea.
- **Merge base antes de push.** Evitar conflictos en el PR.
