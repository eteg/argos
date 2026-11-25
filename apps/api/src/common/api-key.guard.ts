import { timingSafeEqual } from "node:crypto";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { env } from "../config/env.js";
import { IS_PUBLIC } from "./public.decorator.js";
import { ProblemException } from "./problem.js";

function sameKey(received: string, expected: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const received = context.switchToHttp().getRequest<Request>().header("x-api-key");
    if (received && sameKey(received, env.API_KEY)) return true;
    throw new ProblemException(401, "UNAUTHORIZED", "Missing or invalid API key.");
  }
}
