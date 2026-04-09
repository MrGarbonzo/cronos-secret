import { Router } from 'express';
import { CHAIN_ID, SECRET_AI_API_KEY, SECRET_AI_URL } from '../helpers/constants/global.constants.js';
import { logger } from '../helpers/logger.helper.js';
import { AIAgentService } from '../services/agent/agent.service.js';
import { LLMProvider, QueryContext } from '../services/agent/agent.interfaces.js';

const router = Router();

/**
 * POST /api/query/stream
 *
 * SSE endpoint. Tool selection (first LLM call) runs to completion,
 * tools are executed, then the final-response LLM call is streamed
 * token-by-token back to the client.
 *
 * Event shape (all JSON on `data:` lines):
 *   { type: 'tools', functionResponses }   — once, after tool exec
 *   { type: 'token', content }              — many, one per LLM delta
 *   { type: 'done', context, finalResponse } — once, at the end
 *   { type: 'error', message }              — on any failure
 */
router.post('/', async (req, res) => {
  const { query, context = [] } = req.body as { query: string; context?: QueryContext[] };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (obj: object) => {
    res.write('data: ' + JSON.stringify(obj) + '\n\n');
  };

  try {
    if (!query || typeof query !== 'string') {
      send({ type: 'error', message: 'query (string) is required' });
      return res.end();
    }

    const agent = new AIAgentService({
      llmProvider: LLMProvider.SecretAI,
      secretAI: {
        apiKey: SECRET_AI_API_KEY,
        baseUrl: SECRET_AI_URL,
        model: 'qwen3:8b',
      },
      chainId: CHAIN_ID,
      context,
    });

    const interpretation = await agent.interpretUserQuery(query, context);

    const { functionResponses, finalResponse } = await agent.processInterpretationStreaming(
      interpretation,
      query,
      context,
      (token) => send({ type: 'token', content: token }),
      (fr) => send({ type: 'tools', functionResponses: fr })
    );

    const updatedContext = agent.updateContext(context, query, finalResponse);
    send({ type: 'done', context: updatedContext, finalResponse });
    res.end();
  } catch (err) {
    logger.error('Query stream route error:', err);
    try {
      send({ type: 'error', message: err instanceof Error ? err.message : 'Internal server error' });
    } catch {
      /* client may already be gone */
    }
    res.end();
  }
});

export default router;
