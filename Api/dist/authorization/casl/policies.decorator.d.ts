import { Action, Subjects } from './casl.types';
export interface RequiredRule {
    action: Action;
    subject: Subjects;
}
export declare const CHECK_POLICIES_KEY = "check_policies";
export declare const CheckPolicies: (...requirements: RequiredRule[]) => import("@nestjs/common").CustomDecorator<string>;
