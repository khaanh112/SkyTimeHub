import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CHECK_POLICIES_KEY, RequiredRule } from './policies.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers = this.reflector.getAllAndOverride<RequiredRule[]>(CHECK_POLICIES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no policies are defined, allow access (use with @Roles for RBAC)
    if (!policyHandlers || policyHandlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const ability = this.caslAbilityFactory.createForUser(user);

    const hasAllPermissions = policyHandlers.every((rule) =>
      ability.can(rule.action, rule.subject),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
