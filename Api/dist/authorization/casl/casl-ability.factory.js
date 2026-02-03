"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaslAbilityFactory = void 0;
const ability_1 = require("@casl/ability");
const common_1 = require("@nestjs/common");
const roles_enum_1 = require("../../common/enums/roles.enum");
const casl_types_1 = require("./casl.types");
let CaslAbilityFactory = class CaslAbilityFactory {
    createForUser(user) {
        const { can, cannot, build } = new ability_1.AbilityBuilder(ability_1.PureAbility);
        switch (user.role) {
            case roles_enum_1.UserRole.ADMIN:
                can(casl_types_1.Action.Manage, 'all');
                break;
            case roles_enum_1.UserRole.HR:
                can(casl_types_1.Action.Read, 'User');
                can(casl_types_1.Action.Update, 'User');
                can(casl_types_1.Action.Read, 'Leave');
                can(casl_types_1.Action.Approve, 'Leave');
                can(casl_types_1.Action.Reject, 'Leave');
                can(casl_types_1.Action.Read, 'Overtime');
                can(casl_types_1.Action.Approve, 'Overtime');
                can(casl_types_1.Action.Reject, 'Overtime');
                can(casl_types_1.Action.Read, 'Attendance');
                can(casl_types_1.Action.Manage, 'Report');
                can(casl_types_1.Action.Read, 'Department');
                break;
            case roles_enum_1.UserRole.EMPLOYEE:
                can(casl_types_1.Action.Read, 'User');
                can(casl_types_1.Action.Create, 'Leave');
                can(casl_types_1.Action.Read, 'Leave');
                can(casl_types_1.Action.Update, 'Leave');
                can(casl_types_1.Action.Delete, 'Leave');
                can(casl_types_1.Action.Create, 'Overtime');
                can(casl_types_1.Action.Read, 'Overtime');
                can(casl_types_1.Action.Read, 'Attendance');
                break;
            default:
                break;
        }
        return build();
    }
};
exports.CaslAbilityFactory = CaslAbilityFactory;
exports.CaslAbilityFactory = CaslAbilityFactory = __decorate([
    (0, common_1.Injectable)()
], CaslAbilityFactory);
//# sourceMappingURL=casl-ability.factory.js.map