import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { FastifyRequest } from "fastify";
import { ROLES_KEY } from "./auth.decorator";
import { AuthRole } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const requiredRoles =
      this.reflector.getAllAndOverride<AuthRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.includes(AuthRole.SERVICE)) {
      const headerKey = request.headers["x-service-key"] as string;

      if (headerKey) {
        const expectedKey = process.env.SERVICE_KEY;
        if (headerKey === expectedKey) {
          return true;
        }

        throw new UnauthorizedException("Invalid or missing service key");
      }
    }

    if (requiredRoles.some((role) => role !== AuthRole.SERVICE)) {
      const authToken = request.headers["authorization"]?.replace(/^Bearer\s/, "") as string;

      if (authToken) {
        try {
          const payload = this.jwtService.verify(authToken);

          request["user"] = payload;

          if (payload.role && requiredRoles.includes(payload.role)) {
            return true;
          }
        } catch (error) {}

        throw new ForbiddenException(
          `Requires one of the following roles: ${requiredRoles.join(", ")}`,
        );
      }
    }

    throw new UnauthorizedException("Invalid or expired token");
  }
}
