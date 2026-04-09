# CronosxSecret — PoC Plan

## What This Is

A Cronos AI Agent where the LLM reasoning runs privately inside SecretVM via SecretAI (qwen3:8b),
instead of OpenAI/Google Cloud. Private keys and API secrets are injected as encrypted environment
variables at boot and never touch disk. TDX attestation is displayed live in the UI alongside
agent responses.

This is built to show the Cronos CEO at the retreat: their own blockchain tooling, unchanged,
but with private attested AI reasoning underneath it.

---

## Pitch In One Sentence

> "This is your AI agent stack — same blockchain tools, same Cronos APIs — except the LLM reasoning
> never leaves a hardware-encrypted boundary, and that attestation panel proves it."

---

## Reference Repos (read-only, do not modify)

Located at C:\dev\cronos\

- developer-platform-sdk-examples-main/ai/cryptocom-ai-agent-service — the TypeScript service
  we are forking. MIT licensed.
- crypto-agent-trading-main — SKILL.md reference for understanding Crypto.com Exchange API
  patterns. Not used directly.

---

## Project Structure

```
C:\dev\cronosxsecret\
├── PLAN.md                  ← this file
├── NOTES.md                 ← findings, blockers, decisions
├── docker-compose.yaml      ← SecretVM deployment config
├── backend\
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src\
│       ├── index.ts                          ← Express entry point
│       ├── routes\
│       │   ├── query.route.ts                ← POST /api/query
│       │   └── attestation.route.ts          ← GET /api/attestation (proxy to port 29343)
│       ├── services\
│       │   ├── agent\
│       │   │   ├── agent.interfaces.ts       ← MODIFIED: add SecretAI to LLMProvider enum
│       │   │   ├── agent.constants.ts        ← COPIED unchanged
│       │   │   └── agent.service.ts          ← MODIFIED: add SecretAI case to switch
│       │   └── llm\
│       │       ├── llm.interface.ts          ← COPIED unchanged
│       │       ├── llm.factory.ts            ← MODIFIED: add SecretAI case
│       │       ├── openai.service.ts         ← COPIED unchanged (reference)
│       │       ├── deepseek.service.ts       ← COPIED unchanged (reference)
│       │       └── secretai.service.ts       ← NEW: copy of deepseek, different baseURL + model
│       └── helpers\
│           ├── constants\
│           │   └── global.constants.ts       ← MODIFIED: add SECRET_AI_API_KEY, SECRET_AI_URL
│           ├── chain-ai.helpers.ts           ← COPIED unchanged
│           ├── agent.helpers.ts              ← COPIED unchanged
│           └── logger.helper.ts              ← COPIED unchanged
└── frontend\
    └── index.html                            ← NEW: single file, three-panel UI, vanilla JS
```

---

## What Gets Modified vs Copied vs Created New

### COPIED unchanged from reference repo
- agent.constants.ts — all 13 blockchain tool definitions, already correct
- agent.service.ts — blockchain execution logic, all tool calls
- llm.interface.ts — LLMService interface
- openai.service.ts — not used but kept for reference
- deepseek.service.ts — template for secretai.service.ts
- chain-ai.helpers.ts — parameter schemas for tools
- agent.helpers.ts — validation helpers
- logger.helper.ts — logging

### MODIFIED (surgical changes only)

**agent.interfaces.ts** — one line added to LLMProvider enum:
```
SecretAI = 'secretai'
```
And one interface added:
```
SecretAIOptions { apiKey: string; baseUrl: string; model?: string; }
```
And SecretAIOptions added to Options interface.

**llm.factory.ts** — one case added to switch:
```
case LLMProvider.SecretAI:
  return new SecretAIService(options.secretAI)
```

**agent.service.ts** — one case added to initializeLLMService switch:
```
case LLMProvider.SecretAI:
  return new SecretAIService(this.options.secretAI)
```

**global.constants.ts** — add:
```
SECRET_AI_API_KEY = process.env.SECRET_AI_API_KEY
SECRET_AI_URL = process.env.SECRET_AI_URL || 'https://secretai-rytn.scrtlabs.com:21434'
```

### NEW FILES

**secretai.service.ts**
Copy of deepseek.service.ts with these changes:
- baseURL points to SecretAI endpoint (from env var SECRET_AI_URL)
- apiKey from SECRET_AI_API_KEY
- default model: 'qwen3:8b'
- Error messages reference SecretAI instead of DeepSeek
- System prompt updated: "You are a helpful blockchain assistant running privately inside
  a Trusted Execution Environment (TEE). Your reasoning is confidential and hardware-attested."

**attestation.route.ts**
GET /api/attestation — fetches TDX attestation from localhost:29343/attestation and returns it.
Inside SecretVM this returns real attestation. Outside SecretVM (local dev) returns mock data.

**query.route.ts**
POST /api/query — receives { query, context } from frontend.
Hardcodes provider to SecretAI. Passes request to AIAgentService. Returns { finalResponse,
functionResponses, context }.

**index.html**
Single file, no framework, no build step. Three panels:
- Left: chat input + message history
- Center: agent response with loading state
- Right: TDX attestation panel — live, updates on each query
  - Shows MRTD, RTMR0, RTMR1, RTMR2, RTMR3
  - RTMR3 highlighted with label: "Proves docker-compose.yaml integrity"
  - Timestamp of last attestation fetch
  - Green lock icon when attestation is fresh

Fetches /api/query on submit, fetches /api/attestation on page load and after each query.

---

## Environment Variables (injected at SecretVM boot, never on disk)

```
SECRET_AI_API_KEY      SecretAI API key
SECRET_AI_URL          SecretAI base URL (defaults to secretai-rytn.scrtlabs.com:21434)
DASHBOARD_API_KEY      Crypto.com Developer Platform API key
EXPLORER_API_KEY       Cronos explorer API key
CHAIN_ID               25 for mainnet, 338 for testnet (use 338 for demo)
```

Note: No PRIVATE_KEY in Phase 1. Transactions use the Developer Platform magic link
(SSO wallet flow — user clicks to approve). This is safe for demo and avoids any risk
of real funds being moved autonomously.

---

## Architecture Flow

```
User types in browser
        ↓
frontend/index.html (POST /api/query)
        ↓
backend/query.route.ts
        ↓
AIAgentService (agent.service.ts)
  └── SecretAIService.interpretUserQuery()
        ├── Calls SecretAI qwen3:8b at secretai-rytn.scrtlabs.com:21434
        ├── qwen3:8b selects tool(s) from TOOLS list
        └── Returns tool_calls JSON
  └── executeFunction() for each tool_call
        ├── Calls @crypto.com/developer-platform-client
        └── Returns blockchain data
  └── SecretAIService.generateFinalResponse()
        └── qwen3:8b synthesizes natural language response
        ↓
Response + context returned to frontend
        ↓
frontend fetches /api/attestation
        ↓
attestation.route.ts proxies localhost:29343/attestation
        ↓
Attestation panel updates in UI
```

---

## What The Demo Shows

1. User opens URL — attestation panel is already populated from SecretVM port 29343
2. User types: "What is my CRO balance?" (using a pre-loaded testnet address)
3. qwen3:8b inside TEE interprets the query, calls GetBalance tool
4. Cronos Developer Platform returns real balance
5. qwen3:8b synthesizes response
6. UI shows response + attestation refreshes
7. Demo says: "That reasoning — reading your query, deciding what to call, generating
   that response — happened inside the hardware boundary those numbers prove."

Optional live transaction demo (if Cronos testnet wallet funded):
- User types: "Send 1 CRO to [address]"
- Agent returns a magic link URL
- User clicks link → Crypto.com SSO wallet opens for confirmation
- Transaction executes on testnet
- Shows real tx hash on Cronos testnet explorer

---

## The Private Key Pitch (verbal, no code needed)

Point at the reference repo's warning in wallet-management docs:
> "Private keys stored locally may be exposed to malware, unauthorized access..."

Say: "That's their own docs. They have no solution — just a warning. With SecretVM:
- Private key is injected at boot via encrypted channel
- Exists only in TDX-encrypted memory
- Never written to disk
- Not visible to cloud provider, not visible to us
- RTMR3 in that attestation panel proves the code running on the key hasn't been tampered with
- Their warning disappears."

---

## Build Phases

### Phase 1 — Backend service locally (validate everything works)
- Create project structure
- Copy and modify TypeScript files
- Install dependencies
- Run locally, test query endpoint with curl
- Confirm SecretAI qwen3:8b responds and calls tools correctly
- Confirm attestation route works (returns mock locally)

### Phase 2 — Frontend
- Build index.html three-panel UI
- Connect to local backend
- Test full flow: query → response → attestation display

### Phase 3 — Containerize
- Write Dockerfile for Node.js backend
- Write docker-compose.yaml
- Test docker-compose up locally
- Push image to GHCR

### Phase 4 — Deploy to SecretVM
- Deploy docker-compose to SecretVM
- Verify attestation endpoint returns real TDX data from port 29343
- Verify SecretAI calls work from inside SecretVM
- Get a public URL

### Phase 5 — Demo validation
- Fund a Cronos testnet wallet
- Run the full demo script end to end
- Confirm the attestation panel shows real MRTD and RTMR3 values

---

## Key Risk: SecretAI Endpoint Reachability From SecretVM

The SecretAI endpoint (secretai-rytn.scrtlabs.com:21434) needs to be reachable from inside
the SecretVM's network. This should work since SecretVM has outbound internet access, but
confirm early in Phase 4. If the endpoint is not reachable, escalate to Alex Zaidelson —
this is an internal Secret Labs infrastructure question.

---

## Dependencies

```json
{
  "@crypto.com/developer-platform-client": "latest",
  "openai": "^4.x",
  "express": "^4.x",
  "cors": "^2.x",
  "dotenv": "^16.x",
  "typescript": "^5.x"
}
```

Same dependency set as the reference repo. No new dependencies needed.

---

## Files NOT Being Built

- No authentication/auth middleware — demo only
- No rate limiting — demo only
- No database/persistence — stateless, context held in frontend
- No HTTPS termination — SecretVM handles this via auto-TLS
- No streaming — standard request/response is fine for demo

---

## What Claude Code Needs To Know

When sending to Claude Code:

1. Reference repo is at C:\dev\cronos\developer-platform-sdk-examples-main\ai\cryptocom-ai-agent-service
2. Read all files in that directory before writing anything
3. SecretAI is OpenAI-compatible — use the OpenAI SDK with custom baseURL
4. SecretAI baseURL: https://secretai-rytn.scrtlabs.com:21434
5. SecretAI model: qwen3:8b
6. SecretAI requires Authorization header (Bearer token from SECRET_AI_API_KEY env var)
7. Attestation endpoint is localhost:29343/attestation — proxy it, don't process it
8. Frontend is a single index.html, no framework, no build step, vanilla JS fetch
9. Do not use the old cdc-ai-agent-client package — use @crypto.com/developer-platform-client
10. Chain ID 338 for testnet throughout
