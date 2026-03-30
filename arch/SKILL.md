---
name: arch
version: 1.0.0
description: |
  Análisis y documentación de arquitectura. Define interfaces, data flow,
  decisiones técnicas. Se ejecuta entre /plan y /implement.
  Use when: "architecture review", "diseñar la arquitectura", "definir interfaces".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - WebSearch
---

# /arch — Arquitectura & Design

Defines la arquitectura antes de implementar. Interfaces, data flow,
decisiones técnicas documentadas.

## Invocación

- `/arch` — analizar arquitectura actual del proyecto
- `/arch --plan payments` — diseñar arquitectura para un plan específico
- `/arch --adr "usar Redis para cache"` — documentar una decisión técnica (ADR)

## Instrucciones

### Modo 1: Análisis de Arquitectura Actual

```bash
# Estructura del proyecto
find . -maxdepth 4 -type f \( -name '*.ts' -o -name '*.py' -o -name '*.go' -o -name '*.rs' -o -name '*.rb' \) \
  | grep -v node_modules | grep -v __pycache__ | grep -v .git | head -80

# Dependencias
cat package.json 2>/dev/null | jq '.dependencies // {}' 2>/dev/null
cat requirements.txt 2>/dev/null | head -30
cat go.mod 2>/dev/null | grep -A50 'require'

# Entry points
grep -rl "createServer\|app.listen\|main()\|if __name__\|Rails.application" --include='*.ts' --include='*.py' --include='*.go' --include='*.rb' . 2>/dev/null | head -10

# Database
grep -rl "prisma\|sequelize\|typeorm\|sqlalchemy\|activerecord\|diesel\|gorm" --include='*.ts' --include='*.py' --include='*.go' --include='*.rs' --include='*.rb' . 2>/dev/null | head -10

# Config/env
ls .env.example .env.sample config/ 2>/dev/null
```

Producir un diagrama ASCII de la arquitectura:

```
ARQUITECTURA: {proyecto}
═══════════════════════

┌─────────┐     ┌──────────┐     ┌──────────┐
│ Cliente  │────→│ API      │────→│ Database │
│ (React)  │←────│ (Express)│←────│ (Postgres)│
└─────────┘     └────┬─────┘     └──────────┘
                     │
                     ├──→ Redis (cache)
                     ├──→ Stripe (payments)
                     └──→ S3 (uploads)

Componentes: {N}
Entry points: {M}
Dependencias externas: {K}
```

### Modo 2: Diseño para Plan

Dado un plan, definir:

**1. Interfaces:**

```typescript
// Definir ANTES de implementar
interface PaymentService {
  createCheckout(userId: string, items: CartItem[]): Promise<CheckoutSession>;
  handleWebhook(event: StripeEvent): Promise<void>;
  getPaymentHistory(userId: string): Promise<Payment[]>;
}
```

**2. Data Flow:**

```
User clicks "Pay"
  → Frontend: POST /api/checkout { items }
    → Middleware: validate auth + CSRF
      → PaymentService.createCheckout()
        → Stripe API: create session
        → DB: save pending payment
      ← Return checkout URL
    ← 200 { url }
  → Frontend: redirect to Stripe

Stripe webhook
  → POST /api/webhooks/stripe
    → Verify signature
      → PaymentService.handleWebhook()
        → DB: update payment status
        → Email: send receipt
      ← 200
```

**3. ADR (Architecture Decision Record):**

Guardar en `.forge/adrs/{NNN}-{slug}.md`:

```markdown
# ADR-{NNN}: {Título}

**Fecha:** {YYYY-MM-DD}
**Estado:** Aceptado | Propuesto | Deprecado
**Plan:** {plan relacionado}

## Contexto
{Por qué necesitamos tomar esta decisión}

## Decisión
{Qué decidimos hacer}

## Alternativas Consideradas
1. **{Alternativa A}** — {pros} / {contras}
2. **{Alternativa B}** — {pros} / {contras}

## Consecuencias
- ✅ {beneficio}
- ⚠️ {tradeoff}
- ❌ {riesgo aceptado}
```

### Modo 3: ADR Rápido

Para documentar una decisión técnica sin análisis completo:

```bash
mkdir -p .forge/adrs
# Siguiente número
NEXT=$(ls .forge/adrs/*.md 2>/dev/null | wc -l | tr -d ' ')
NEXT=$((NEXT + 1))
printf -v NEXT "%03d" $NEXT
```

Crear ADR con el template, commitear:

```bash
git add .forge/adrs/
git commit -m "docs: ADR-{NNN} {título}"
```

## Output

```
ARCH: {proyecto}
════════════════
Modo: {análisis | diseño | adr}

{Diagrama de arquitectura}

Interfaces definidas: {N}
ADRs documentados: {M}
Data flows mapeados: {K}

Archivos creados:
  - .forge/adrs/{NNN}-{slug}.md
```

## Reglas

- **Interfaces antes de código.** Definir contratos antes de implementar.
- **ADRs son inmutables.** No editar, crear uno nuevo que lo depreca.
- **Diagramas ASCII.** No herramientas externas, todo en markdown.
- **Data flow completo.** Desde el input del usuario hasta la DB y vuelta.
