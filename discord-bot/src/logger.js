import { config } from './config.js';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const threshold = LEVELS[config.logLevel];

function log(level, args) {
  if (LEVELS[level] < threshold) return;

  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
  if (level === 'warn') {
    console.warn(prefix, ...args);
  } else if (level === 'error') {
    console.error(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

export const logger = {
  debug: (...args) => log('debug', args),
  info: (...args) => log('info', args),
  warn: (...args) => log('warn', args),
  error: (...args) => log('error', args),
};
