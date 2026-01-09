import { logger } from './logger.js';
import { config } from './config.js';
import { HEADERS } from '../constants/index.js';

const DISALLOWED_HEADERS = [
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  HEADERS.API_KEY.toLowerCase(),
];

export const forwardRequest = async (url: string, request: Request) => {
  const method = request.method;

  try {
    const targetUrl = new URL(url);
    const domain = targetUrl.hostname.toLowerCase();

    if (
      config.allowedDomains.length > 0 &&
      !config.allowedDomains.includes(domain)
    ) {
      logger.warn({ domain, url }, 'SSRF Block: Domain not in allowlist');
      throw new Error(`Forbidden: ${domain} is not in the allowlist`);
    }
  } catch (e: any) {
    if (e.message.startsWith('Forbidden')) throw e;
    throw new Error(`Invalid URL: ${url}`);
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!DISALLOWED_HEADERS.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const body = ['GET', 'HEAD'].includes(method) ? null : request.body;

  logger.debug({ method, target_url: url }, 'Forwarding request to upstream');

  const response = await fetch(url, {
    method,
    headers,
    body,
    // @ts-ignore - Handle stream properly in Bun
    duplex: 'half',
  });

  logger.debug(
    { status_code: response.status, target_url: url },
    'Upstream response received',
  );

  return response;
};
