import http from 'http';
import https from 'https';
import { URL } from 'url';
import { Router } from 'express';
import { logger } from '../helpers/logger.helper.js';

const router = Router();

// SecretVM exposes the attestation agent over HTTPS with a self-signed cert.
// Inside a container, "localhost" is the container — use the docker bridge
// gateway (172.17.0.1) to reach the VM host. Override with ATTESTATION_URL
// for local dev or alternate topologies.
const ATTESTATION_URL =
  process.env.ATTESTATION_URL || 'https://172.17.0.1:29343/cpu';

interface ParsedAttestation {
  valid: boolean;
  mock?: boolean;
  report: {
    mr_td?: string;
    rt_mr0?: string;
    rt_mr1?: string;
    rt_mr2?: string;
    rt_mr3?: string;
    report_data?: string;
    tcb_status?: string;
  };
  errors: string[];
}

function mockAttestation(reason: string): ParsedAttestation {
  return {
    valid: false,
    mock: true,
    report: {
      mr_td: 'MOCK_MRTD_0000000000000000000000000000000000000000000000000000000000000000',
      rt_mr0: 'MOCK_RTMR0_000000000000000000000000000000000000000000000000000000000000',
      rt_mr1: 'MOCK_RTMR1_000000000000000000000000000000000000000000000000000000000000',
      rt_mr2: 'MOCK_RTMR2_000000000000000000000000000000000000000000000000000000000000',
      rt_mr3: 'MOCK_RTMR3_000000000000000000000000000000000000000000000000000000000000',
      report_data: 'MOCK_REPORT_DATA',
      tcb_status: 'MOCK_LOCAL_DEV',
    },
    errors: [`attestation agent unreachable (${reason})`],
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
        // Self-signed cert on the internal attestation agent.
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
    rawBody = await fetchQuote(ATTESTATION_URL, 3000);
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : 'unknown';
    logger.warn(`Attestation endpoint unreachable, returning mock: ${msg}`);
    return res.json(mockAttestation(msg));
  }

  // The attestation agent returns a raw hex-encoded TDX quote.
  let rawQuote: unknown = rawBody.trim();
  try {
    // If it happened to be JSON, parse it so secretvm-verify sees structured data.
    rawQuote = JSON.parse(rawBody);
  } catch {
    /* keep as string */
  }

  try {
    const { checkTdxCpuAttestation } = await import('secretvm-verify');
    const result = await checkTdxCpuAttestation(rawQuote as never);
    return res.json({
      valid: result.valid,
      report: {
        mr_td: result.report?.mr_td,
        rt_mr0: result.report?.rt_mr0,
        rt_mr1: result.report?.rt_mr1,
        rt_mr2: result.report?.rt_mr2,
        rt_mr3: result.report?.rt_mr3,
        report_data: result.report?.report_data,
        tcb_status: result.report?.tcb_status,
      },
      errors: result.errors || [],
    });
  } catch (verifyErr) {
    const msg = verifyErr instanceof Error ? verifyErr.message : 'unknown';
    logger.error('secretvm-verify failed:', verifyErr);
    return res.status(500).json({
      valid: false,
      report: {},
      errors: [`secretvm-verify error: ${msg}`],
    });
  }
});

export default router;
