import { UsersService } from './users.service';
import { User } from './users.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ImportUserRow } from './dto/import-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getAllUsers(): Promise<User[]>;
    getCurrentUserProfile(userId: number): Promise<User>;
    getUserById(id: number): Promise<User>;
    createUser(user: CreateUserDto): Promise<User>;
    updateUser(id: number, user: UpdateUserDto): Promise<User>;
    deleteUser(id: number): Promise<void>;
    getActivationLink(id: number): Promise<{
        activationLink: string;
        token: string;
    }>;
    previewImport(file: Express.Multer.File): Promise<import("./dto/import-user.dto").ImportPreviewResult>;
    executeImport(rows: ImportUserRow[]): Promise<import("./dto/import-user.dto").ImportExecuteResult>;
}
