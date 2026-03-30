#!/bin/bash
# forge setup — Instala forge en un proyecto existente de forma segura.
#
# Uso:
#   # Global (todos los proyectos)
#   ./setup.sh --global
#
#   # En un proyecto específico
#   cd /path/to/project && /path/to/forge/setup.sh
#
# Flags:
#   --global       Instalar en ~/.claude/skills/ (no toca el proyecto)
#   --with-hooks   Instalar hooks de git (solo si no existen)
#   --with-browser Instalar Playwright para QA browser testing
#   --dry-run      Mostrar qué haría sin ejecutar

set -euo pipefail

FORGE_DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false
GLOBAL=false
WITH_HOOKS=false
WITH_BROWSER=false

for arg in "$@"; do
  case "$arg" in
    --global) GLOBAL=true ;;
    --with-hooks) WITH_HOOKS=true ;;
    --with-browser) WITH_BROWSER=true ;;
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      echo "Usage: ./setup.sh [--global] [--with-hooks] [--with-browser] [--dry-run]"
      echo ""
      echo "  --global        Install to ~/.claude/skills/forge (all projects)"
      echo "  --with-hooks    Install git hooks (only if they don't exist)"
      echo "  --with-browser  Install Playwright + Chromium for QA"
      echo "  --dry-run       Show what would happen without doing it"
      exit 0
      ;;
  esac
done

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    eval "$@"
  fi
}

echo "🔨 Forge Setup"
echo "═══════════════"

# --- Global install ---
if $GLOBAL; then
  TARGET="$HOME/.claude/skills/forge"
  if [ -d "$TARGET" ]; then
    echo "⚠️  Already installed at $TARGET"
    echo "   To update: cd $TARGET && git pull"
    exit 0
  fi
  echo "📦 Installing to $TARGET..."
  run "cp -r '$FORGE_DIR' '$TARGET'"
  run "rm -rf '$TARGET/.git'"
  echo "✅ Installed globally. Available in all Claude Code projects."
  echo ""
  echo "Next: open Claude Code and try /plan"
  exit 0
fi

# --- Project install ---
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
echo "📍 Project: $PROJECT_ROOT"

# 1. Copy forge to .claude/skills/
SKILLS_DIR="$PROJECT_ROOT/.claude/skills/forge"
if [ -d "$SKILLS_DIR" ]; then
  echo "⚠️  Forge already installed in this project at $SKILLS_DIR"
  echo "   To update: rm -rf $SKILLS_DIR && re-run setup"
else
  echo "📦 Copying forge to .claude/skills/forge..."
  run "mkdir -p '$PROJECT_ROOT/.claude/skills'"
  run "cp -r '$FORGE_DIR' '$SKILLS_DIR'"
  run "rm -rf '$SKILLS_DIR/.git'"
  echo "   ✅ Skills installed"
fi

# 2. Add .forge/ to .gitignore (if not already there)
GITIGNORE="$PROJECT_ROOT/.gitignore"
if [ -f "$GITIGNORE" ]; then
  if ! grep -q "^\.forge/$" "$GITIGNORE" 2>/dev/null; then
    echo "📝 Adding .forge/ to .gitignore..."
    run "echo '' >> '$GITIGNORE'"
    run "echo '# Forge (engineering workflow)' >> '$GITIGNORE'"
    run "echo '.forge/' >> '$GITIGNORE'"
    echo "   ✅ .gitignore updated"
  else
    echo "   ✅ .forge/ already in .gitignore"
  fi
else
  echo "📝 Creating .gitignore with .forge/..."
  run "echo '# Forge (engineering workflow)' > '$GITIGNORE'"
  run "echo '.forge/' >> '$GITIGNORE'"
  echo "   ✅ .gitignore created"
fi

# 3. CLAUDE.md — append forge section (if not already there)
CLAUDE_MD="$PROJECT_ROOT/CLAUDE.md"
if [ -f "$CLAUDE_MD" ]; then
  if ! grep -q "Forge" "$CLAUDE_MD" 2>/dev/null; then
    echo "📝 Adding Forge section to CLAUDE.md..."
    run "cat >> '$CLAUDE_MD' << 'FORGE_SECTION'

## Forge — Engineering Workflow

Skills: /plan, /arch, /implement, /test, /review, /fix, /ship, /cso, /build

Routing:
- Plan/design → /plan
- Build feature → /build
- Code review → /review
- Test → /test
- Security audit → /cso
- Ship/deploy/PR → /ship

Generated files in .forge/ (gitignored).
FORGE_SECTION"
    echo "   ✅ CLAUDE.md updated (appended, nothing modified)"
  else
    echo "   ✅ CLAUDE.md already has Forge section"
  fi
else
  echo "   ℹ️  No CLAUDE.md found (forge works without it, routing won't be automatic)"
fi

# 4. Git hooks (optional, non-destructive)
if $WITH_HOOKS; then
  HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
  if [ -d "$HOOKS_DIR" ]; then
    for hook in pre-commit pre-push; do
      HOOK_FILE="$HOOKS_DIR/$hook"
      if [ -f "$HOOK_FILE" ]; then
        echo "   ⚠️  $hook hook already exists — skipping (won't overwrite)"
        echo "      Merge manually from: .claude/skills/forge/hooks/$hook"
      else
        echo "📎 Installing $hook hook..."
        run "cp '$FORGE_DIR/hooks/$hook' '$HOOK_FILE'"
        run "chmod +x '$HOOK_FILE'"
        echo "   ✅ $hook installed"
      fi
    done
  else
    echo "   ⚠️  .git/hooks not found (not a git repo?)"
  fi
fi

# 5. Browser (optional)
if $WITH_BROWSER; then
  echo "🌐 Installing Playwright + Chromium..."
  run "cd '$SKILLS_DIR/browser' && npm install && npx playwright install chromium"
  echo "   ✅ Browser ready"
fi

# --- Summary ---
echo ""
echo "═══════════════"
echo "✅ Forge installed!"
echo ""
echo "Try:"
echo "  /plan \"describe your feature\""
echo "  /build \"build something\""
echo "  /review"
echo "  /cso"
echo ""
echo "Docs: $SKILLS_DIR/SETUP.md"
