import { logger } from './logger.js';

export const forwardRequest = async (url: string, request: Request) => {
  const method = request.method;
  const headers = new Headers(request.headers);

  // Remove headers that might interfere with the target
  headers.delete('host');
  headers.delete('X-Zenith-Key'); // Don't leak our key to upstream

  // TODO: Here you would inject private upstream keys if needed
  // Example: headers.set('Authorization', `Bearer ${process.env.OPENAI_API_KEY}`);

  logger.debug({ method, url }, 'Forwarding request to upstream');

  const body = ['GET', 'HEAD'].includes(method) ? null : await request.blob();

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  logger.debug({ status: response.status, url }, 'Upstream response received');

  return response;
};
