"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OTStatus = exports.LeaveStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["HR"] = "hr";
    UserRole["EMPLOYEE"] = "employee";
    UserRole["DEPARTMENT_LEADER"] = "department_leader";
    UserRole["BOD"] = "bod";
})(UserRole || (exports.UserRole = UserRole = {}));
var LeaveStatus;
(function (LeaveStatus) {
    LeaveStatus["PENDING"] = "pending";
    LeaveStatus["APPROVED"] = "approved";
    LeaveStatus["REJECTED"] = "rejected";
    LeaveStatus["CANCELLED"] = "cancelled";
    LeaveStatus["DONE"] = "done";
})(LeaveStatus || (exports.LeaveStatus = LeaveStatus = {}));
var OTStatus;
(function (OTStatus) {
    OTStatus["PENDING"] = "pending";
    OTStatus["APPROVED"] = "approved";
    OTStatus["REJECTED"] = "rejected";
    OTStatus["CANCELLED"] = "cancelled";
    OTStatus["DONE"] = "done";
})(OTStatus || (exports.OTStatus = OTStatus = {}));
//# sourceMappingURL=roles.enum.js.map