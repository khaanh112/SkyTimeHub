import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
export declare class InvalidFormatException extends BadRequestException {
    constructor(message?: string);
}
