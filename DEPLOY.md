# Deploying cronos-secret to a SecretVM

## Quick reference

1. **Create the SecretVM** via the SecretVM portal.
2. **Enable the HTTPS endpoint toggle** in the portal before the first
   boot. This is **off by default** — the app will not be reachable
   over TLS until you turn it on.
3. **Upload `docker-compose.yaml`** from this repo.
4. **Inject the secrets** via the portal's secure env flow:
   - `SECRET_AI_API_KEY`
   - `SECRET_AI_URL` (e.g. `https://secretai-rytn.scrtlabs.com:21434`)
   - `DASHBOARD_API_KEY` (Cronos Developer Platform)
   - `EXPLORER_API_KEY` (Cronos Explorer)
   - `CHAIN_ID` (338 for testnet, 25 for mainnet)
5. **Boot.**

Visit `https://<vm-name>.vm.scrtlabs.com/` — frontend should render
immediately.

## Why the HTTPS toggle matters

SecretVM's platform provides TLS termination in front of whatever port
the container publishes. With the toggle on, requests to
`https://<vm>.vm.scrtlabs.com/` are terminated by the platform and
forwarded to the container on port 3000. With the toggle off, there
is no TLS listener in front of the container, and the app is
effectively unreachable from the public internet.

We used to run an in-container Traefik reverse proxy to handle TLS
ourselves. That caused a chain of bugs (SecretVM's boot pipeline
injects labels on user-declared Traefik services, strips redirect
flags from the Traefik command line, and has an attestation endpoint
that requires specific networking). All of those go away when you
let the platform do the HTTPS work.

## Smoke test

```bash
VM=<vm-name>.vm.scrtlabs.com

# Frontend
curl -s -o /dev/null -w "root: %{http_code}\n" https://$VM/

# Health
curl -s https://$VM/health

# Agent attestation — should be valid:true on a real SecretVM
curl -s https://$VM/api/attestation | grep -o '"valid":[^,]*'

# SecretAI LLM attestation — should also be valid:true
curl -s https://$VM/api/secretai-attestation | grep -o '"valid":[^,]*'

# Streaming query (needs API keys injected)
curl -N -X POST https://$VM/api/query/stream \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the latest Cronos block?"}'
```

## Troubleshooting

### `https://<vm>/` is unreachable or times out

The HTTPS toggle is off. Enable it in the portal and reboot the VM.

### `/api/attestation` returns `mock: true`

The backend can't reach the SecretVM attestation agent on the VM host.
The default URL is `https://172.17.0.1:29343/cpu` (docker bridge
gateway). If Docker networking puts the container somewhere the host
IP differs, override it by adding an env var to the portal:

```
ATTESTATION_URL=https://<some-other-host>:29343/cpu
```

### `/api/query/stream` returns an error immediately

Check that `SECRET_AI_API_KEY` and `DASHBOARD_API_KEY` were actually
injected. The backend reads them on request, so a missing key will
surface as a 500 error, not a startup crash.

## Rollback

```bash
git log --oneline docker-compose.yaml
git show <previous-sha>:docker-compose.yaml > docker-compose.yaml
```

Re-upload to the portal. The image on GHCR is unchanged across this
refactor, so rollback is a pure config swap with no rebuild.
