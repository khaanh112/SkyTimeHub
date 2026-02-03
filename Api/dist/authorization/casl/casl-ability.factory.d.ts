import { PureAbility } from '@casl/ability';
import { User } from '../../users/users.entity';
import { Action, Subjects } from './casl.types';
export type AppAbility = PureAbility<[Action, Subjects]>;
export declare class CaslAbilityFactory {
    createForUser(user: User): AppAbility;
}
