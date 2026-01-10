import { Context } from 'hono';
import { ContentfulStatusCode } from 'hono/utils/http-status';

export type ProblemDetail = {
  type: string;
  title: string;
  status: ContentfulStatusCode;
  detail?: string;
  instance?: string;
  [key: string]: any;
};

export const createProblem = (
  c: Context,
  status: ContentfulStatusCode,
  type: string,
  title: string,
  detail?: string,
  extras?: Record<string, any>,
): Response => {
  const problem: ProblemDetail = {
    type: `https://zenith.io/probs/${type}`,
    title,
    status,
    detail,
    instance: c.req.path,
    ...extras,
  };

  return c.json(problem, status, {
    'Content-Type': 'application/problem+json',
  });
};

export const problems = {
  badRequest: (c: Context, detail?: string) =>
    createProblem(c, 400, 'bad-request', 'Bad Request', detail),

  unauthorized: (
    c: Context,
    detail: string = 'Authentication credentials required or invalid',
  ) => createProblem(c, 401, 'unauthorized', 'Unauthorized', detail),

  forbidden: (c: Context, detail: string = 'Access denied') =>
    createProblem(c, 403, 'forbidden', 'Forbidden', detail),

  notFound: (c: Context, detail: string = 'Resource not found') =>
    createProblem(c, 404, 'not-found', 'Not Found', detail),

  rateLimited: (
    c: Context,
    detail: string = 'Rate limit exceeded',
    retryAfter?: number,
  ) => {
    const headers: Record<string, any> = {};
    if (retryAfter) {
      headers['Retry-After'] = retryAfter;
      c.header('Retry-After', String(retryAfter));
    }
    return createProblem(
      c,
      429,
      'rate-limited',
      'Rate Limit Exceeded',
      detail,
      headers,
    );
  },

  quotaExceeded: (c: Context, detail: string = 'Monthly quota exceeded') =>
    createProblem(c, 429, 'quota-exceeded', 'Quota Exceeded', detail),

  internalError: (
    c: Context,
    detail: string = 'An unexpected error occurred',
  ) =>
    createProblem(
      c,
      500,
      'internal-server-error',
      'Internal Server Error',
      detail,
    ),

  badGateway: (c: Context, detail: string = 'Upstream service failed') =>
    createProblem(c, 502, 'bad-gateway', 'Bad Gateway', detail),

  gatewayTimeout: (c: Context, detail: string = 'Upstream service timed out') =>
    createProblem(c, 504, 'gateway-timeout', 'Gateway Timeout', detail),
};
