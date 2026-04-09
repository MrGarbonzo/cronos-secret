import { Router } from 'express';
import { CHAIN_ID, SECRET_AI_API_KEY, SECRET_AI_URL } from '../helpers/constants/global.constants.js';
import { logger } from '../helpers/logger.helper.js';
import { AIAgentService } from '../services/agent/agent.service.js';
import { LLMProvider, QueryContext } from '../services/agent/agent.interfaces.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { query, context = [] } = req.body as { query: string; context?: QueryContext[] };

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query (string) is required' });
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
    const { functionResponses, finalResponse } = await agent.processInterpretation(
      interpretation,
      query,
      context
    );
    const updatedContext = agent.updateContext(context, query, finalResponse);

    return res.json({ finalResponse, functionResponses, context: updatedContext });
  } catch (err) {
    logger.error('Query route error:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

export default router;
