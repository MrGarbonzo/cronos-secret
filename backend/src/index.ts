import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PORT } from './helpers/constants/global.constants.js';
import { logger } from './helpers/logger.helper.js';
import routes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../../frontend')));
app.use(routes);

app.listen(PORT, () => {
  logger.info(`cronosxsecret backend listening on port ${PORT}`);
});
