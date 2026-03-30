---
name: cso
version: 1.0.0
description: |
  Security audit: secrets, supply chain, CI/CD, OWASP, STRIDE, LLM security.
  Dos modos: daily (8/10 confidence gate) y comprehensive (2/10).
  Use when: "security audit", "cso", "pentest", "OWASP", "security review".
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - WebSearch
---

# /cso — Chief Security Officer Audit

Auditoría de seguridad del proyecto. Piensas como atacante, reportas como defensor.
Sin security theater: solo findings reales con evidence.

## Invocación

- `/cso` — audit completo, modo daily (8/10 confidence gate)
- `/cso --comprehensive` — deep scan mensual (2/10 gate, más findings)
- `/cso --diff` — solo cambios del branch actual
- `/cso --infra` — solo infraestructura (CI/CD, Docker, IaC)
- `/cso --code` — solo código (OWASP, injection, auth)
- `/cso --supply-chain` — solo dependencias

## Fases

### Fase 0: Reconocimiento

Detectar stack, framework, arquitectura. Construir modelo mental del proyecto.

```bash
# Stack
ls package.json tsconfig.json Gemfile requirements.txt go.mod Cargo.toml 2>/dev/null

# Framework
grep -l "next\|express\|fastify\|hono" package.json 2>/dev/null
grep -l "django\|fastapi\|flask" requirements.txt pyproject.toml 2>/dev/null

# Infra
find .github/workflows -name '*.yml' 2>/dev/null
find . -maxdepth 3 -name 'Dockerfile*' -o -name 'docker-compose*.yml' 2>/dev/null
ls .env .env.* 2>/dev/null
```

### Fase 1: Attack Surface

Mapear endpoints públicos, autenticados, admin, uploads, webhooks, background jobs.

```
ATTACK SURFACE
══════════════
  Endpoints públicos:    {N}
  Autenticados:          {N}
  Admin:                 {N}
  File uploads:          {N}
  Webhooks:              {N}
  External integrations: {N}
```

### Fase 2: Secrets Archaeology

Buscar secrets expuestos en git history:

```bash
# AWS keys
git log -p --all -S "AKIA" --diff-filter=A -- "*.env" "*.yml" "*.json" 2>/dev/null | head -30

# API keys
git log -p --all -S "sk-" --diff-filter=A -- "*.env" "*.yml" "*.json" "*.ts" "*.js" 2>/dev/null | head -30

# GitHub tokens
git log -p --all -G "ghp_|gho_|github_pat_" 2>/dev/null | head -30

# .env tracked
git ls-files '*.env' '.env.*' 2>/dev/null | grep -v '.example\|.sample'

# .gitignore check
grep -q "^\.env$" .gitignore 2>/dev/null && echo ".env gitignored" || echo "⚠️ .env NOT gitignored"
```

**Severity:** CRITICAL para secrets activos, HIGH para .env tracked.

### Fase 3: Supply Chain

```bash
# Vulnerabilities conocidas
npm audit --json 2>/dev/null | head -50
pip audit --json 2>/dev/null | head -50
cargo audit --json 2>/dev/null | head -50

# Install scripts en deps de producción (supply chain attack vector)
# Buscar postinstall/preinstall en node_modules de deps directas
```

### Fase 4: CI/CD Security

Para cada workflow de CI:
- ¿Actions pinneados por SHA? (no `@v3`, sino `@sha256:...`)
- ¿`pull_request_target`? (peligroso: forks con write access)
- ¿Script injection via `${{ github.event.* }}`?
- ¿Secrets como env vars? (pueden leakear en logs)

### Fase 5: Infrastructure

- Dockerfiles: ¿`USER` directive? ¿Secrets como `ARG`?
- DB connection strings en configs commiteados
- Terraform: ¿`"*"` en IAM policies?

### Fase 6: Webhooks & Integrations

Para cada webhook handler:
- ¿Verificación de firma? (HMAC, Stripe signature, etc.)
- ¿TLS verification deshabilitado?

### Fase 7: LLM/AI Security

- User input en system prompts (prompt injection)
- Output de LLM renderizado como HTML sin sanitizar
- eval/exec de output de LLM
- Tool calling sin validación
- API keys de AI hardcodeadas

### Fase 8: OWASP Top 10

| # | Categoría | Qué buscar |
|---|-----------|-----------|
| A01 | Broken Access Control | Endpoints sin auth, IDOR |
| A02 | Crypto Failures | MD5, SHA1, secrets hardcoded |
| A03 | Injection | SQL, command, template injection |
| A04 | Insecure Design | Sin rate limit en auth |
| A05 | Misconfiguration | CORS wildcard, debug en prod |
| A06 | Vulnerable Components | Ver Fase 3 |
| A07 | Auth Failures | Session management, JWT |
| A08 | Integrity Failures | Deserialization, CI/CD |
| A09 | Logging Failures | Auth events no logueados |
| A10 | SSRF | URLs construidas con user input |

### Fase 9: STRIDE Threat Model

Para cada componente principal:

```
COMPONENTE: {nombre}
  Spoofing:              ¿Se puede impersonar?
  Tampering:             ¿Se puede modificar data?
  Repudiation:           ¿Hay audit trail?
  Information Disclosure: ¿Puede leakear data?
  Denial of Service:     ¿Se puede saturar?
  Elevation:             ¿Se puede escalar privilegios?
```

### Fase 10: False Positive Filtering

**Confidence gate:**
- Daily: solo reportar ≥ 8/10
- Comprehensive: reportar ≥ 2/10 (marcar `TENTATIVE` si < 8)

**Auto-descartar:**
- Vulnerabilities en tests/fixtures
- Frameworks con protección built-in (React XSS, Rails CSRF)
- Docker para dev local
- Env vars y CLI flags (trusted input)
- DoS/rate limiting (excepto LLM cost amplification)

### Fase 11: Reporte

Guardar en `.forge/reports/security-{timestamp}.json`.

Output:

```
CSO SECURITY AUDIT
═══════════════════
Modo: daily | comprehensive
Fecha: {YYYY-MM-DD HH:MM}

FINDINGS:
  #{N} [{SEV}] (confidence: {X}/10) {file}:{line} — {descripción}
       Exploit: {paso-a-paso del ataque}
       Fix: {recomendación concreta}

RESUMEN:
  Critical: {N}
  High:     {N}
  Medium:   {N}
  Filtered: {N} false positives descartados

POSTURA: 🔴 CRÍTICA | 🟡 NECESITA ATENCIÓN | 🟢 ACEPTABLE
```

Si hay findings CRITICAL, incluir **Incident Response Playbook**:
1. Revocar credencial
2. Rotar — generar nueva
3. Limpiar history — `git filter-repo` o BFG
4. Force push
5. Auditar ventana de exposición
6. Revisar logs del proveedor

## Reglas

- **Think like attacker, report like defender.**
- **Evidence obligatoria.** Sin evidence no hay finding.
- **Zero noise > zero misses.** 3 findings reales > 3 reales + 12 teóricos.
- **No security theater.** No flaggear riesgos teóricos sin path de explotación.
- **Read-only.** Nunca modificar código. Solo reportar.
- **Disclaimer:** Esta herramienta no reemplaza una auditoría profesional de seguridad.
