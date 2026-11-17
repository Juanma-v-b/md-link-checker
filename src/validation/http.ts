import type { IssueCode, Severity } from '../types.js';
import { VERSION } from '../version.js';

const USER_AGENT = `md-link-checker/${VERSION}`;

/**
 * Statuses that usually mean "this server does not want bots" or "slow down",
 * not "this page is gone". Reporting them as errors would create false
 * positives on perfectly healthy links.
 */
const BLOCKED_STATUSES = new Set([401, 403, 405, 429]);

const TIMEOUT_CODES = new Set([
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

export type HttpFailureCode = Extract<
  IssueCode,
  'HTTP_ERROR' | 'HTTP_BLOCKED' | 'HTTP_TIMEOUT' | 'NETWORK_ERROR' | 'REDIRECT_LOOP'
>;

export interface HttpFailure {
  code: HttpFailureCode;
  severity: Severity;
  message: string;
  status?: number;
}

export type HttpOutcome =
  | { ok: true; status: number; finalUrl: string }
  | { ok: false; failure: HttpFailure };

export interface HttpCheckOptions {
  timeoutMs: number;
  userAgent?: string;
}

/**
 * Checks one URL with a single `GET`.
 *
 * `HEAD` is intentionally not used: many servers reject it or answer
 * differently, which is a classic source of false positives. The body is
 * cancelled as soon as the headers arrive, so the cost stays low.
 */
export async function checkUrl(rawUrl: string, options: HttpCheckOptions): Promise<HttpOutcome> {
  const url = normalizeUrl(rawUrl);

  if (!isValidUrl(url)) {
    return {
      ok: false,
      failure: {
        code: 'NETWORK_ERROR',
        severity: 'error',
        message: `invalid URL "${rawUrl}"`,
      },
    };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': options.userAgent ?? USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    return { ok: false, failure: describeFailure(error, options.timeoutMs) };
  }

  await response.body?.cancel();

  if (response.status < 400) {
    return { ok: true, status: response.status, finalUrl: response.url };
  }

  if (BLOCKED_STATUSES.has(response.status)) {
    return {
      ok: false,
      failure: {
        code: 'HTTP_BLOCKED',
        severity: 'warning',
        message: `request blocked with status ${response.status}`,
        status: response.status,
      },
    };
  }

  return {
    ok: false,
    failure: {
      code: 'HTTP_ERROR',
      severity: 'error',
      message: `request failed with status ${response.status}`,
      status: response.status,
    },
  };
}

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();

  // Protocol-relative links inherit the scheme of the page they appear on;
  // for a checker, HTTPS is the safe assumption.
  return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function describeFailure(error: unknown, timeoutMs: number): HttpFailure {
  if (isTimeout(error)) {
    return timeoutFailure(timeoutMs);
  }

  const code = failureCode(error);
  const detail = errorDetail(error);

  if (code === 'ERR_TOO_MANY_REDIRECTS' || /redirect/i.test(detail)) {
    return {
      code: 'REDIRECT_LOOP',
      severity: 'error',
      message: 'redirect loop detected',
    };
  }

  if (code !== null && TIMEOUT_CODES.has(code)) {
    return timeoutFailure(timeoutMs);
  }

  return {
    code: 'NETWORK_ERROR',
    severity: 'error',
    message: code === null ? 'request failed' : `request failed (${code})`,
  };
}

function timeoutFailure(timeoutMs: number): HttpFailure {
  return {
    code: 'HTTP_TIMEOUT',
    severity: 'warning',
    message: `request timed out after ${timeoutMs} ms`,
  };
}

function isTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'TimeoutError' || error.name === 'AbortError';
}

/** Undici wraps the real network error in `cause`, sometimes as an AggregateError. */
function failureCode(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  return codeOf(cause);
}

function codeOf(value: unknown): string | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const record = value as { code?: unknown; errors?: unknown };

  if (typeof record.code === 'string') {
    return record.code;
  }

  if (Array.isArray(record.errors)) {
    for (const nested of record.errors) {
      const code = codeOf(nested);
      if (code !== null) {
        return code;
      }
    }
  }

  return null;
}

function errorDetail(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const causeMessage = cause instanceof Error ? cause.message : '';

  return `${error.name} ${error.message} ${causeMessage}`;
}
