import { User } from "./users.entity";
import { Repository } from "typeorm";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ImportUserRow, ImportPreviewResult, ImportExecuteResult } from "./dto/import-user.dto";
export declare class UsersService {
    private usersRepository;
    constructor(usersRepository: Repository<User>);
    generateEmployeeId(): Promise<string>;
    generateActivationToken(): string;
    getUsers(): Promise<User[]>;
    getUser(id: number): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    findByEmployeeId(employeeId: string): Promise<User | null>;
    createUser(user: CreateUserDto): Promise<User>;
    updateUser(id: number, user: UpdateUserDto): Promise<User>;
    updateRefreshToken(userId: number, refreshTokenHash: string | null): Promise<void>;
    deleteUser(id: number): Promise<void>;
    activateAccount(token: string): Promise<User>;
    resendActivation(userId: number): Promise<User>;
    getActivationToken(userId: number): Promise<string>;
    previewImport(file: Express.Multer.File): Promise<ImportPreviewResult>;
    executeImport(rows: ImportUserRow[]): Promise<ImportExecuteResult>;
    private isValidEmail;
    private isValidPhone;
}
