import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import type { Response } from "express";
import { ProblemException, problemType } from "./problem.js";

const titles: Record<string, string> = {
  VALIDATION: "Invalid data",
  UNAUTHORIZED: "Unauthorized",
  NOT_FOUND: "Not found",
  FILE_TOO_LARGE: "File too large",
  UNSUPPORTED_FILE: "Unsupported file",
  RATE_LIMITED: "Too many requests",
  UNAVAILABLE: "Service unavailable",
};

const codeByStatus: Record<number, string> = {
  400: "VALIDATION",
  401: "UNAUTHORIZED",
  404: "NOT_FOUND",
  413: "FILE_TOO_LARGE",
  415: "UNSUPPORTED_FILE",
  429: "RATE_LIMITED",
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ProblemException) {
      return this.send(response, exception.getStatus(), exception.code, exception.detail, exception.errors);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = codeByStatus[status] ?? "UNAVAILABLE";
      return this.send(response, status, code, exception.message);
    }

    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    return this.send(response, 500, "UNAVAILABLE", "The API could not complete the request.");
  }

  private send(
    response: Response,
    status: number,
    code: string,
    detail?: string,
    errors?: { field: string; code: string }[],
  ) {
    response
      .status(status)
      .type("application/problem+json")
      .send({
        type: problemType(code),
        title: titles[code] ?? code,
        status,
        code,
        detail: detail ?? titles[code] ?? code,
        ...(errors ? { errors } : {}),
      });
  }
}
