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

import { isPrivateIP, resolveIP } from '../utils/network.js';

/**
 * Forwards an incoming HTTP request to a target upstream URL.
 *
 * Implements multiple layers of protection and resilience:
 * 1. SSRF Protection: Validates domain allowlist and blocks internal/private IP ranges.
 * 2. Header Security: Strips hop-by-hop and sensitive headers (like API keys).
 * 3. Body Handling: Streams request body for non-idempotent methods (POST, PUT, etc.).
 * 4. Resilience: Automatically retries idempotent requests (GET, HEAD) up to 2 times
 *    with exponential backoff on upstream failures.
 *
 * @param url - The full destination URL for the proxy request.
 * @param request - The original inbound Request object from Hono.
 * @returns A Promise resolving to the upstream Response.
 * @throws {Error} if the URL is invalid, SSRF is detected, or retries are exhausted.
 */
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

    const ip = await resolveIP(domain);
    if (ip && isPrivateIP(ip)) {
      logger.warn({ domain, ip, url }, 'SSRF Block: Internal IP detected');
      throw new Error(`Forbidden: Access to internal IP ${ip} is blocked`);
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

  const maxRetries = ['GET', 'HEAD'].includes(method) ? 2 : 0;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        // @ts-ignore
        duplex: 'half',
      });

      logger.debug(
        { status_code: response.status, target_url: url, attempt },
        'Upstream response received',
      );

      return response;
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries) {
        logger.error(
          { error: error.message, url, attempt },
          'Proxy Upstream Error after all retries',
        );
        throw error;
      }
      logger.warn(
        { error: error.message, url, attempt },
        'Retrying upstream request...',
      );

      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  throw new Error('Proxy Request Failed');
};
