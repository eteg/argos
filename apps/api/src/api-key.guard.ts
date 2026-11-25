import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC } from "./public.decorator";

// Chave por ambiente no cabeçalho X-Api-Key (ADR 0002).
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const key = context.switchToHttp().getRequest<Request>().header("x-api-key");
    if (!process.env.API_KEY || key !== process.env.API_KEY) throw new UnauthorizedException();
    return true;
  }
}
