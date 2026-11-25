import { HttpException } from "@nestjs/common";

export interface ProblemError {
  field: string;
  code: string;
}

export class ProblemException extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    readonly detail?: string,
    readonly errors?: ProblemError[],
  ) {
    super(detail ?? code, status);
  }
}

export function problemType(code: string) {
  return `https://argos.eteg.com.br/errors/${code.toLowerCase().replaceAll("_", "-")}`;
}
