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
