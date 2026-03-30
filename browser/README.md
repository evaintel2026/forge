# Forge Browser

Browser toolkit para QA testing. Dos niveles:

## Nivel 1: Script mode (default)

Sin daemon, sin binarios. Usa Playwright directamente via npx.
Cold start ~3s, sin estado persistente entre comandos.

```bash
# Instalar (una vez)
npx playwright install chromium

# Usar desde forge
node .claude/skills/forge/browser/browse.mjs snapshot https://myapp.com
node .claude/skills/forge/browser/browse.mjs click "#login-button"
node .claude/skills/forge/browser/browse.mjs screenshot output.png
```

## Nivel 2: Daemon mode (opt-in)

Para QA sessions largas donde necesitas login persistente.
Estado, cookies y tabs sobreviven entre comandos. ~100ms por comando.

```bash
# Iniciar daemon
node .claude/skills/forge/browser/daemon.mjs start

# Comandos van al daemon (mismo API que nivel 1)
node .claude/skills/forge/browser/browse.mjs --daemon snapshot https://myapp.com

# Parar daemon
node .claude/skills/forge/browser/daemon.mjs stop
```

## Requisitos

- Node.js 18+ (ya necesario para Claude Code)
- Chromium (instalado via Playwright)

NO requiere: Bun, binarios compilados, ni nada que no venga con un setup estándar de dev.
