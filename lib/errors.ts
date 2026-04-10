/**
 * curl-cffi-node error hierarchy.
 *
 * Maps CURLcode values to typed error subclasses for structured error handling.
 */

/** CURLcode values for common error scenarios. */
export enum CurlCode {
  OK = 0,
  UNSUPPORTED_PROTOCOL = 1,
  COULDNT_RESOLVE_PROXY = 5,
  COULDNT_RESOLVE_HOST = 6,
  COULDNT_CONNECT = 7,
  OPERATION_TIMEDOUT = 28,
  SSL_CONNECT_ERROR = 35,
  SSL_PEER_CERTIFICATE = 51,
  SSL_CERTPROBLEM = 58,
  SSL_CIPHER = 59,
  SSL_CACERT = 60,
  SEND_ERROR = 55,
  RECV_ERROR = 56,
  PROXY = 97,
}

/**
 * Base error class for all curl errors.
 *
 * Contains the CURLcode and the original curl error message.
 */
export class CurlError extends Error {
  /** The CURLcode that caused this error. */
  readonly code: number;
  /** The original curl error description. */
  readonly curlMessage: string;

  constructor(code: number, curlMessage: string) {
    super(`curl error (${code}): ${curlMessage}`);
    this.name = 'CurlError';
    this.code = code;
    this.curlMessage = curlMessage;
    // Fix prototype chain for instanceof
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a request times out (CURLcode 28).
 */
export class TimeoutError extends CurlError {
  constructor(curlMessage: string) {
    super(CurlCode.OPERATION_TIMEDOUT, curlMessage);
    this.name = 'TimeoutError';
  }
}

/**
 * Thrown when connection fails (CURLcode 6, 7).
 */
export class ConnectionError extends CurlError {
  constructor(code: number, curlMessage: string) {
    super(code, curlMessage);
    this.name = 'ConnectionError';
  }
}

/**
 * Thrown when TLS/SSL fails (CURLcode 35, 51, 58, 59, 60).
 */
export class TLSError extends CurlError {
  constructor(code: number, curlMessage: string) {
    super(code, curlMessage);
    this.name = 'TLSError';
  }
}

/**
 * Thrown when proxy fails (CURLcode 5, 97).
 */
export class ProxyError extends CurlError {
  constructor(code: number, curlMessage: string) {
    super(code, curlMessage);
    this.name = 'ProxyError';
  }
}

/** Parse a native curl error string into a typed error. */
export function parseCurlError(message: string): CurlError {
  // Native errors have format: "curl error (CODE): MESSAGE"
  const match = message.match(/^curl error \((\d+)\): (.+)$/);
  if (!match) {
    return new CurlError(-1, message);
  }

  const code = parseInt(match[1], 10);
  const curlMessage = match[2];

  switch (code) {
    case CurlCode.OPERATION_TIMEDOUT:
      return new TimeoutError(curlMessage);

    case CurlCode.COULDNT_RESOLVE_HOST:
    case CurlCode.COULDNT_CONNECT:
      return new ConnectionError(code, curlMessage);

    case CurlCode.SSL_CONNECT_ERROR:
    case CurlCode.SSL_PEER_CERTIFICATE:
    case CurlCode.SSL_CERTPROBLEM:
    case CurlCode.SSL_CIPHER:
    case CurlCode.SSL_CACERT:
      return new TLSError(code, curlMessage);

    case CurlCode.COULDNT_RESOLVE_PROXY:
    case CurlCode.PROXY:
      return new ProxyError(code, curlMessage);

    default:
      return new CurlError(code, curlMessage);
  }
}
