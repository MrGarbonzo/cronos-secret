import { Router } from 'express';
import { logger } from '../helpers/logger.helper.js';

const router = Router();

const ATTESTATION_URL = 'http://localhost:29343/cpu';

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
    errors: [`mock data — localhost:29343 unreachable (${reason})`],
  };
}

router.get('/', async (_req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    let rawQuote: unknown;
    try {
      const response = await fetch(ATTESTATION_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        return res.json(mockAttestation(`HTTP ${response.status}`));
      }
      rawQuote = await response.json();
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      logger.warn(
        `Attestation endpoint unreachable, returning mock: ${
          fetchErr instanceof Error ? fetchErr.message : 'unknown'
        }`
      );
      return res.json(
        mockAttestation(fetchErr instanceof Error ? fetchErr.message : 'fetch failed')
      );
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
      logger.error('secretvm-verify failed:', verifyErr);
      return res.status(500).json({
        valid: false,
        report: {},
        errors: [
          `secretvm-verify error: ${
            verifyErr instanceof Error ? verifyErr.message : 'unknown'
          }`,
        ],
      });
    }
  } catch (err) {
    logger.error('Attestation route error:', err);
    return res.status(500).json({
      valid: false,
      report: {},
      errors: [err instanceof Error ? err.message : 'unknown error'],
    });
  }
});

export default router;
