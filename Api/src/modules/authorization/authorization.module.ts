import { Module, Global } from '@nestjs/common';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import { PoliciesGuard } from './casl/policies.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  providers: [CaslAbilityFactory, PoliciesGuard, RolesGuard],
  exports: [CaslAbilityFactory, PoliciesGuard, RolesGuard],
})
export class AuthorizationModule {}
