import { AbilityBuilder, AbilityClass, PureAbility } from '@casl/ability';
import { Action, Subjects } from './casl.types';
import { Injectable } from '@nestjs/common';
import { User } from '@entities/users.entity';
import { UserRole } from '@common/enums/roles.enum';

export type AppAbility = PureAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User) {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      PureAbility as AbilityClass<AppAbility>,
    );

    // =====================================================
    // CONFIGURE YOUR PERMISSIONS HERE
    // =====================================================

    switch (user.role) {
      case UserRole.ADMIN:
        // Admin can do everything
        can(Action.Manage, 'all');
        break;

      case UserRole.HR:
        // HR permissions - customize as needed
        can(Action.Read, 'User');
        can(Action.Update, 'User');
        can(Action.Read, 'Leave');
        can(Action.Approve, 'Leave');
        can(Action.Reject, 'Leave');
        can(Action.Read, 'Overtime');
        can(Action.Approve, 'Overtime');
        can(Action.Reject, 'Overtime');
        can(Action.Read, 'Attendance');
        can(Action.Manage, 'Report');
        can(Action.Read, 'Department');
        break;

      case UserRole.EMPLOYEE:
        // Employee permissions - customize as needed
        can(Action.Read, 'User'); // Can only read their own (add condition later)
        can(Action.Create, 'Leave');
        can(Action.Read, 'Leave');
        can(Action.Update, 'Leave'); // Only their own pending leaves
        can(Action.Delete, 'Leave'); // Only their own pending leaves
        can(Action.Create, 'Overtime');
        can(Action.Read, 'Overtime');
        can(Action.Read, 'Attendance');
        break;

      default:
        // No permissions by default
        break;
    }

    // =====================================================
    // ADD CUSTOM CONDITIONS HERE
    // Example: User can only update their own profile
    // can(Action.Update, 'User', { id: user.id });
    // =====================================================

    return build();
  }
}
