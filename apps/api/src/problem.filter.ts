import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response } from "express";

const CODES: Record<number, string> = {
  400: "VALIDATION",
  401: "UNAUTHORIZED",
  404: "NOT_FOUND",
  413: "FILE_TOO_LARGE",
  415: "UNSUPPORTED_FILE",
  429: "RATE_LIMITED",
  503: "UNAVAILABLE",
};

// Erro com code específico da operação, como 409 SITE_NOT_IN_PROGRESS.
export class ProblemException extends HttpException {
  constructor(status: number, code: string, detail: string, extra: Record<string, unknown> = {}) {
    super({ code, message: detail, ...extra }, status);
  }
}

// Todo erro sai em Problem Details (RFC 9457), como pedem as convenções.
@Catch()
export class ProblemFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const extra = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const code = typeof extra.code === "string" ? extra.code : (CODES[status] ?? (status >= 500 ? "UNAVAILABLE" : "ERROR"));
    if (status >= 500) console.error(exception);
    const { message, error: _error, statusCode: _statusCode, code: _code, ...rest } = extra;
    res
      .status(status)
      .type("application/problem+json")
      .json({
        type: `https://argos.eteg.com.br/errors/${code.toLowerCase()}`,
        title: status >= 500 ? "Unavailable" : exception instanceof HttpException ? exception.message : "Error",
        status,
        code,
        detail: typeof message === "string" ? message : null,
        ...rest,
      });
  }
}
