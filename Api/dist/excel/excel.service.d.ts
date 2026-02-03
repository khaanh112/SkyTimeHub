import { Repository } from 'typeorm';
import { User } from '../users/users.entity';
import { ImportUserRow, ImportPreviewResult, ImportExecuteResult } from '../users/dto/import-user.dto';
export declare class ExcelService {
    private usersRepository;
    constructor(usersRepository: Repository<User>);
    previewUserImport(file: Express.Multer.File): Promise<ImportPreviewResult>;
    executeUserImport(rows: ImportUserRow[], generateEmployeeId: () => Promise<string>, generateActivationToken: () => string): Promise<ImportExecuteResult>;
    exportUsersToExcel(users: User[]): Promise<Buffer>;
    private isValidEmail;
    private isValidPhone;
}
