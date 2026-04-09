import http from 'http';
import https from 'https';
import { URL } from 'url';
import { Router } from 'express';
import { SECRETAI_ATTESTATION_URL } from '../helpers/constants/global.constants.js';
import { logger } from '../helpers/logger.helper.js';

const router = Router();

// Hardcoded — this is what we're trying to prove we're talking to.
// The model name must match the one the SecretAI service is configured
// to use in src/services/llm/secretai.service.ts.
const SECRETAI_MODEL = 'qwen3:8b';
const SECRETAI_ENDPOINT = (() => {
  try {
    return new URL(SECRETAI_ATTESTATION_URL).hostname;
  } catch {
    return 'secretai-rytn.scrtlabs.com';
  }
})();

interface SecretAIAttestation {
  valid: boolean;
  mock?: boolean;
  model: string;
  endpoint: string;
  report: {
    mr_td?: string;
    rt_mr0?: string;
    rt_mr1?: string;
    rt_mr2?: string;
    rt_mr3?: string;
    tcb_status?: string;
  };
  errors: string[];
}

function mockSecretAIAttestation(reason: string): SecretAIAttestation {
  return {
    valid: false,
    mock: true,
    model: SECRETAI_MODEL,
    endpoint: SECRETAI_ENDPOINT,
    report: {
      mr_td: 'MOCK_MRTD_SECRETAI_00000000000000000000000000000000000000000000000000',
      rt_mr0: 'MOCK_RTMR0_SECRETAI_0000000000000000000000000000000000000000000000000',
      rt_mr1: 'MOCK_RTMR1_SECRETAI_0000000000000000000000000000000000000000000000000',
      rt_mr2: 'MOCK_RTMR2_SECRETAI_0000000000000000000000000000000000000000000000000',
      rt_mr3: 'MOCK_RTMR3_SECRETAI_0000000000000000000000000000000000000000000000000',
      tcb_status: 'MOCK_LOCAL_DEV',
    },
    errors: [`SecretAI attestation unreachable (${reason})`],
  };
}

function fetchQuote(urlStr: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (resp) => {
        const chunks: Buffer[] = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (!resp.statusCode || resp.statusCode < 200 || resp.statusCode >= 300) {
            reject(new Error(`HTTP ${resp.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          resolve(body);
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

router.get('/', async (_req, res) => {
  let rawBody: string;
  try {
    rawBody = await fetchQuote(SECRETAI_ATTESTATION_URL, 4000);
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : 'unknown';
    logger.warn(`SecretAI attestation unreachable, returning mock: ${msg}`);
    return res.json(mockSecretAIAttestation(msg));
  }

  let rawQuote: unknown = rawBody.trim();
  try {
    rawQuote = JSON.parse(rawBody);
  } catch {
    /* keep as string */
  }

  try {
    const { checkTdxCpuAttestation } = await import('secretvm-verify');
    const result = await checkTdxCpuAttestation(rawQuote as never);
    const response: SecretAIAttestation = {
      valid: result.valid,
      model: SECRETAI_MODEL,
      endpoint: SECRETAI_ENDPOINT,
      report: {
        mr_td: result.report?.mr_td,
        rt_mr0: result.report?.rt_mr0,
        rt_mr1: result.report?.rt_mr1,
        rt_mr2: result.report?.rt_mr2,
        rt_mr3: result.report?.rt_mr3,
        tcb_status: result.report?.tcb_status,
      },
      errors: result.errors || [],
    };
    return res.json(response);
  } catch (verifyErr) {
    const msg = verifyErr instanceof Error ? verifyErr.message : 'unknown';
    logger.error('secretvm-verify failed for SecretAI quote:', verifyErr);
    return res.status(500).json({
      valid: false,
      model: SECRETAI_MODEL,
      endpoint: SECRETAI_ENDPOINT,
      report: {},
      errors: [`secretvm-verify error: ${msg}`],
    });
  }
});

export default router;
