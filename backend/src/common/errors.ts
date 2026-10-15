import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends HttpException {
  constructor(
    readonly code: string,
    status = 400,
  ) {
    super({ code }, status);
  }
}
export function requireCondition(
  condition: unknown,
  code: string,
  status = 400,
): asserts condition {
  if (!condition) throw new ApiError(code, status);
}
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : error instanceof ZodError
          ? 400
          : 503;
    const code =
      error instanceof ApiError
        ? error.code
        : error instanceof ZodError
          ? "INVALID_REQUEST"
          : status === 404
            ? "NOT_FOUND"
            : "SERVICE_UNAVAILABLE";
    res
      .status(status)
      .json({ error: { code, request_id: res.locals.correlationId } });
    // Never serialize errors, URLs, request bodies, cookies or headers containing secrets.
    if (status >= 500)
      console.error(
        JSON.stringify({
          event: "request_failed",
          method: req.method,
          status,
          request_id: res.locals.correlationId,
        }),
      );
  }
}
