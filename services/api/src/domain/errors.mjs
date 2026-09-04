export class DomainError extends Error {
  constructor(message, { status, code }) {
    super(message);
    this.name = 'DomainError';
    this.status = status;
    this.code = code;
  }
}

export class InvalidInput extends DomainError {
  constructor(message) {
    super(message, { status: 400, code: 'invalid_input' });
    this.name = 'InvalidInput';
  }
}

export class Unauthorized extends DomainError {
  constructor(message = 'Missing or invalid booth token.') {
    super(message, { status: 401, code: 'unauthorized' });
    this.name = 'Unauthorized';
  }
}

export class NotFound extends DomainError {
  constructor(message = 'Not found.') {
    super(message, { status: 404, code: 'not_found' });
    this.name = 'NotFound';
  }
}

export class PayloadTooLarge extends DomainError {
  constructor(message) {
    super(message, { status: 413, code: 'payload_too_large' });
    this.name = 'PayloadTooLarge';
  }
}

export class RateLimited extends DomainError {
  constructor(message = 'Too many requests.', retryAfterMs = 0) {
    super(message, { status: 429, code: 'rate_limited' });
    this.name = 'RateLimited';
    this.retryAfterMs = retryAfterMs;
  }
}

export class ServiceUnavailable extends DomainError {
  constructor(message) {
    super(message, { status: 503, code: 'service_unavailable' });
    this.name = 'ServiceUnavailable';
  }
}

export class UpstreamError extends DomainError {
  constructor(message) {
    super(message, { status: 502, code: 'upstream_error' });
    this.name = 'UpstreamError';
  }
}
