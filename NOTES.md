# CronosxSecret — Notes

## Key Findings

### SecretAI
- Endpoint: https://secretai-rytn.scrtlabs.com:21434
- Available models: qwen3:8b, llama3.2-vision:latest, gemma3:4b, deepseek-r1:70b
- Tool calling: ONLY qwen3:8b supports native tool calling (confirmed with parallel multi-tool test)
- API is OpenAI-compatible — use OpenAI SDK with custom baseURL
- Auth: Authorization: Bearer <SECRET_AI_API_KEY>

### Cronos AI Agent Service Architecture
- TypeScript/Express service
- LLM factory pattern with provider enum — clean extensibility
- DeepSeek implementation uses OpenAI SDK with custom baseURL — identical pattern for SecretAI
- All 13 blockchain tools already defined in agent.constants.ts
- Blockchain calls go through @crypto.com/developer-platform-client
- Client.init() requires DASHBOARD_API_KEY and DEVELOPER_PLATFORM_PROVIDER_URL

### Blockchain Tools Available
- GetBalance — native token balance for an address
- GetLatestBlock — latest block height
- GetTransactionsByAddress — tx history for an address
- GetContractABI — verified contract ABI
- GetTransactionByHash — tx details by hash
- GetBlockByTag — block by number or tag (latest/earliest/pending)
- GetTransactionStatus — tx status by hash
- CreateWallet — creates new wallet (returns address + private key + mnemonic)
- TransferToken — transfer native or ERC20 token (via magic link/SSO)
- WrapToken — wrap token
- SwapToken — swap between two tokens
- GetCurrentTime — current local and UTC time
- GetErc20Balance — ERC20 balance for address + contract

### Transaction Approach For Demo
- Phase 1 demo uses magic link (SSO wallet) flow for transfers — user clicks to approve
- Direct private key transfer is marked EXPERIMENTAL in reference code
- Private key pitch is verbal only in Phase 1 — the architecture supports it but we don't demo it live
- Cronos testnet chain ID: 338

### Cronos Developer Platform
- API key required from: https://developer.crypto.com/
- Explorer API key from: https://developers.zkevm.cronos.org/user/apikeys
- Provider URL: from constants (need to check exact value in reference repo)

### Attestation
- SecretVM exposes TDX attestation at localhost:29343/attestation
- RTMR3 is the key field — proves docker-compose.yaml integrity
- Backend proxies this endpoint so frontend can display it
- Outside SecretVM: returns mock data for local dev

---

## SecretVM Deployment Pattern

Reference: C:\dev\corbitsxsecret\docker-compose.chat-demo.yaml
This is the proven working pattern for getting an HTTPS URL like https://violet-yak.vm.scrtlabs.com/

### How SecretVM HTTPS Works
- SecretVM auto-generates TLS certificates for the VM's subdomain (e.g. violet-yak.vm.scrtlabs.com)
- Certs are stored at /mnt/secure/cert/ on the VM:
  - /mnt/secure/cert/secret_vm_fullchain.pem
  - /mnt/secure/cert/secret_vm_private.pem
- Traefik v2.10 acts as the reverse proxy, terminating HTTPS and routing to the app
- HTTP (port 80) redirects to HTTPS (port 443) automatically via Traefik entry points

### docker-compose.yaml Structure For HTTPS
Three components: the app service, Traefik, and a tls_config config block.

App service:
- Use `expose` NOT `ports` — Traefik handles routing, no direct port exposure
- Add to `traefik` network
- Add Traefik routing labels:
  - traefik.enable=true
  - traefik.http.routers.<name>.rule=PathPrefix(`/`)
  - traefik.http.routers.<name>.entrypoints=websecure
  - traefik.http.routers.<name>.tls=true
  - traefik.http.services.<name>.loadbalancer.server.port=<app-port>

Traefik service:
- Image: traefik:v2.10
- Ports: 80:80 and 443:443
- Volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro (Docker discovery)
  - /mnt/secure/cert:/certs:ro (SecretVM auto-certs)
- configs: source tls_config → target /etc/traefik/dynamic/tls.yml
- Command flags: providers.docker, providers.file.directory, entrypoints, HTTP→HTTPS redirect

tls_config (embedded in docker-compose as `configs` block):
- Points Traefik at /certs/secret_vm_fullchain.pem and /certs/secret_vm_private.pem
- Sets default certificate for the domain

Networks:
- One bridge network named `traefik` shared by app and Traefik

### Secret Injection Pattern
Two approaches used in Corbits:
1. Environment block with bare variable names (e.g. `- SECRET_AI_API_KEY`) — SecretVM injects
   at boot from the VM's secure environment
2. env_file: - usr/.env — SecretVM writes injected secrets to usr/.env at boot

For cronosxsecret: use approach #1 (bare env var names in environment block).
Secrets injected at SecretVM boot via the portal/CLI — never in any file on disk.

### Port to Expose Internally
App listens on port 3000 internally. Traefik routes external 443 → internal 3000.
The `expose: ["3000"]` declaration tells Docker/Traefik the internal port.

### Full docker-compose.yaml Template For This Project
```yaml
services:
  cronosxsecret:
    image: ghcr.io/mrgarbonzo/cronosxsecret:latest
    expose:
      - "3000"
    environment:
      - SECRET_AI_API_KEY
      - SECRET_AI_URL
      - DASHBOARD_API_KEY
      - EXPLORER_API_KEY
      - CHAIN_ID
    restart: unless-stopped
    networks:
      - traefik
    labels:
      - traefik.enable=true
      - traefik.http.routers.cronosxsecret.rule=PathPrefix(`/`)
      - traefik.http.routers.cronosxsecret.entrypoints=websecure
      - traefik.http.routers.cronosxsecret.tls=true
      - traefik.http.services.cronosxsecret.loadbalancer.server.port=3000
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  traefik:
    image: traefik:v2.10
    command:
      - --api.insecure=false
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
      - --entrypoints.web.http.redirections.entrypoint.to=websecure
      - --entrypoints.web.http.redirections.entrypoint.scheme=https
      - --entrypoints.websecure.address=:443
      - --providers.file.directory=/etc/traefik/dynamic
      - --providers.file.watch=true
    ports:
      - 80:80
      - 443:443
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /mnt/secure/cert:/certs:ro
    networks:
      - traefik
    configs:
      - source: tls_config
        target: /etc/traefik/dynamic/tls.yml
    restart: unless-stopped

networks:
  traefik:
    driver: bridge

configs:
  tls_config:
    content: |-
      tls:
        certificates:
          - certFile: /certs/secret_vm_fullchain.pem
            keyFile: /certs/secret_vm_private.pem
        stores:
          default:
            defaultCertificate:
              certFile: /certs/secret_vm_fullchain.pem
              keyFile: /certs/secret_vm_private.pem
```

### Attestation Port (29343)
The attestation endpoint at localhost:29343 is internal to the SecretVM — not routed through
Traefik. The backend proxies it internally (localhost:29343/cpu etc.) and exposes it at
/api/attestation on the main HTTPS URL. No direct external exposure of port 29343 needed.

---

## SecretVM Tooling (C:\dev\)

### secretvm-verify (C:\dev\secretvm-verify-main)
SDK for verifying SecretVM attestation. Available as both Python (pip install secretvm-verify)
and Node.js (npm install secretvm-verify) packages.

What it can do for this project:
- checkSecretVm(url) — end-to-end VM verification: TLS binding + CPU (TDX) attestation + GPU attestation
- checkTdxCpuAttestation(data) — verify a raw TDX quote, returns MRTD, RTMR0-3, report_data, tcb_status
- verifyWorkload(quote, dockerComposeYaml) — proves a specific docker-compose.yaml is what's running
  Returns: authentic_match | authentic_mismatch | not_authentic
- resolveSecretVmVersion(quote) — looks up which official SecretVM template/version produced the quote

Key field for demo: RTMR3 — this is what gets highlighted in the attestation panel.
verifyWorkload() replays the RTMR3 measurement from docker-compose content and compares
to the live quote. This is the cryptographic proof the right code is running.

Usage in attestation route:
- Fetch raw quote from localhost:29343/cpu
- Pass to checkTdxCpuAttestation() to get parsed MRTD + RTMRs for display
- Optionally call verifyWorkload() with the docker-compose.yaml to show authentic_match
- Return all of this to the frontend attestation panel

Node.js import:
  import { checkSecretVm, checkTdxCpuAttestation, verifyWorkload, resolveSecretVmVersion } from 'secretvm-verify'

AttestationResult fields: valid, attestationType, checks, report (contains mr_td, rt_mr0-3,
report_data, tcb_status), errors

### secret-code-provenance (C:\dev\secret-code-provenance)
Resolves Docker images in a docker-compose file to their exact source code commits on GitHub.
Available as Python (pip install code-provenance) and Node.js (npm install code-provenance).

What it can do for this project:
- Given the docker-compose.yaml running in SecretVM, resolves each image to:
  - GitHub repo URL
  - Exact commit SHA
  - Confidence level (exact | approximate)
- Works via OCI labels, GHCR Packages API, tag matching, repo inference

Usage in attestation panel (optional enhancement):
- When the attestation route fetches the docker-compose.yaml, also run code-provenance on it
- Display the resolved commit URLs next to each service in the attestation panel
- This lets the Cronos CEO click through to the exact source code that's running
- Combined with verifyWorkload() this is a complete trust chain:
  docker-compose → RTMR3 proves it's running → code-provenance shows what code it is → GitHub shows the source

Node.js import:
  import { parseCompose, parseImageRef, resolveImage } from 'code-provenance'

Confidence levels: exact (OCI revision label or exact git tag) | approximate (latest tag, prefix match)

### How These Two Tools Work Together In The Demo

The attestation panel can show a complete trust chain:

1. TDX quote from localhost:29343/cpu → checkTdxCpuAttestation() → MRTD + RTMR0-3 displayed
2. RTMR3 + docker-compose.yaml → verifyWorkload() → "authentic_match" badge shown
3. docker-compose.yaml images → code-provenance → GitHub commit links for each service
4. Visual result: "This VM is running commit abc123 of your-repo, and RTMR3 proves it"

This is the complete verifiable story in a single panel. No trust required at any step.

---

## Open Questions
- [ ] What is DEVELOPER_PLATFORM_PROVIDER_URL in global.constants.ts? Check reference repo.
- [ ] Does the Cronos testnet (338) work with free Developer Platform tier?
- [ ] Is secretai-rytn.scrtlabs.com:21434 reachable from SecretVM outbound network?
- [ ] Does the SecretVM expose the docker-compose.yaml at an endpoint, or do we embed it in the backend?

## Decisions Made
- Using cryptocom-ai-agent-service as fork base (MIT license, TypeScript, clean LLM factory)
- SecretAI as the ONLY LLM provider — hardcoded in query route, no provider selection in UI
- No direct private key transactions in Phase 1 — magic link only
- Single index.html frontend — no framework, no build step
- Chain ID 338 (testnet) throughout for safety
- Use secretvm-verify Node.js package in attestation route for proper TDX quote parsing
- code-provenance is optional enhancement for Phase 2+ (commit links in attestation panel)
- HTTPS via Traefik v2.10 + SecretVM auto-certs at /mnt/secure/cert/
- App exposes port 3000 internally; Traefik routes external 443 to it
- docker-compose.yaml is the final template (see SecretVM Deployment Pattern section above)

## Timeline
- Phase 1 (backend + attestation route, local): 1-2 days
- Phase 2 (frontend): 1 day
- Phase 3 (containerize + docker-compose): 0.5 days
- Phase 4 (SecretVM deploy, get HTTPS URL): 0.5 days
- Phase 5 (demo validation): 0.5 days
- Total: ~4 days of focused building
