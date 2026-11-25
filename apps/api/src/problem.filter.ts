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

// Todo erro sai em Problem Details (RFC 9457), como pedem as convenções.
@Catch()
export class ProblemFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = CODES[status] ?? (status >= 500 ? "UNAVAILABLE" : "ERROR");
    if (status >= 500) console.error(exception);
    res
      .status(status)
      .type("application/problem+json")
      .json({
        type: `https://argos.eteg.com.br/errors/${code.toLowerCase()}`,
        title: exception instanceof HttpException ? exception.message : "Unavailable",
        status,
        code,
      });
  }
}
