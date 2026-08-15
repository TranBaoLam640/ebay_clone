export class AppError extends Error {
  constructor(statusCode, code, message, details, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
  }
}
