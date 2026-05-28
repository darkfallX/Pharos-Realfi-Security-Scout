---
name: Pharos RealFi Security Scout
description: x402-paid micro security scanner for Pharos contracts and RealFi positions that returns instant professional risk intelligence before agents move funds.
version: 1.0.0
category: security
tags:
  - pharos
  - realfi
  - security
  - x402
  - usdc
  - agent-safety
entrypoint:
  type: http
  method: POST
  url: "${SERVER_URL}/scan"
  authentication:
    type: x402
    header: PAYMENT-SIGNATURE
    alternateHeaders:
      - X-PAYMENT
      - x-payment-proof
env:
  SERVER_URL: https://pharos-realfi-security-scout-production.up.railway.app
---

# Pharos RealFi Security Scout

Pharos RealFi Security Scout is a production-grade onchain risk skill for agent-native finance.  
Before an agent deposits, swaps, routes strategy capital, or interacts with an RWA vault, it can pay a tiny USDC micro-fee via x402 and receive an instant structured risk report.

Set `SERVER_URL` to your deployed API base (e.g. `https://pharos-realfi-security-scout-production.up.railway.app`).

## What this skill checks

- Reentrancy risk flags
- Owner/admin privilege exposure
- Upgradeable proxy signals (EIP-1967 + delegatecall hints)
- Timelock and delay protections
- External low-level call risk indicators
- Basic access control pattern hints
- Final overall risk score and risk tier (Low / Medium / High)

## Input

`POST ${SERVER_URL}/scan`

```json
{
  "contractAddress": "0x...",
  "context": "Optional strategy context, e.g. RWA vault deposit path"
}
```

Headers (x402):

- `PAYMENT-SIGNATURE` or `X-PAYMENT` — signed x402 payment payload (production)
- `PAYMENT-RESPONSE` — settlement receipt on success (response header)

## Output

Structured JSON report with:

- professional executive summary
- detailed security/risk flags
- objective scoring and risk level
- practical recommendations for autonomous agents

## Example prompts for agents

- "Run security scan on contract 0x... before I deposit USDC"
- "Check risk on this RWA vault 0x..."
- "Before allocating to this yield strategy, pay and get a full Pharos security scout report"
- "Scan Agra orderbook integration contract 0x... and tell me if admin risks are acceptable"
- "Audit this rcPC / pAlpha contract quickly and give me a go/no-go risk score"
