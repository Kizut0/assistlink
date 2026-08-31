// Typed application error. Thrown anywhere; translated to a JSON response by
// the central errorHandler middleware.
export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message = 'Bad Request', details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }
  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }
  static notFound(message = 'Not Found'): ApiError {
    return new ApiError(404, message);
  }
  static conflict(message = 'Conflict'): ApiError {
    return new ApiError(409, message);
  }
}
