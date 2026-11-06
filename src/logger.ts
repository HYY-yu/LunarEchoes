export type Level = 'debug' | 'info' | 'warn' | 'error';
export function log(level: Level, event: string, details: object = {}) {
  const entry = { scope: 'lunar-relay', event, ...details };
  if (level === 'debug') { if (new URLSearchParams(location.search).has('debug')) console.debug(entry); }
  else console[level](entry);
}
