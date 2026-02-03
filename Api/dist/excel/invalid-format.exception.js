"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidFormatException = void 0;
const bad_request_exception_1 = require("@nestjs/common/exceptions/bad-request.exception");
class InvalidFormatException extends bad_request_exception_1.BadRequestException {
    constructor(message) {
        super(message || 'Invalid file format');
    }
}
exports.InvalidFormatException = InvalidFormatException;
//# sourceMappingURL=invalid-format.exception.js.map