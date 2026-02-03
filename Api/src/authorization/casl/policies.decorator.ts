import { SetMetadata } from '@nestjs/common';
import { Action, Subjects } from './casl.types';

export interface RequiredRule {
  action: Action;
  subject: Subjects;
}

export const CHECK_POLICIES_KEY = 'check_policies';
export const CheckPolicies = (...requirements: RequiredRule[]) =>
  SetMetadata(CHECK_POLICIES_KEY, requirements);
