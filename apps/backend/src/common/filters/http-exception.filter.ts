import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Nest's HttpException stores a structured response (the per-field
    // validation messages, a custom error code, etc.) on `getResponse()`.
    // Surfacing the string `exception.message` here would drop that detail and
    // emit only "Bad Request" for class-validator payloads. Resolve the
    // structured response and extract its `message` field when present; fall
    // back to the exception message for plain HttpExceptions and to a generic
    // string for unknown errors.
    let message: string;
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (
        typeof exceptionResponse === 'object'
        && exceptionResponse !== null
        && 'message' in exceptionResponse
      ) {
        const messageValue = (exceptionResponse as { message: unknown }).message;
        message = Array.isArray(messageValue)
          ? messageValue.join(', ')
          : typeof messageValue === 'string'
            ? messageValue
            : exception.message;
      } else {
        message = exception.message;
      }
    } else {
      message = 'Internal server error';
    }

    this.logger.error(`${status} - ${message}`, exception instanceof Error ? exception.stack : '');

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
