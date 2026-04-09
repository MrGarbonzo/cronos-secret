import winston, { createLogger, format, transports } from 'winston';
import { IS_PROD_ENV } from './constants/global.constants.js';

const { combine, errors, colorize, printf } = format;

const customFormat = printf((info) => {
  const log = `${info.level}: ${info.message}`;
  return info.stack ? `${log}\n${info.stack}` : log;
});

export const logger: winston.Logger = createLogger({
  level: IS_PROD_ENV ? 'info' : 'debug',
  format: combine(errors({ stack: true }), colorize(), customFormat),
  transports: [
    new transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});
