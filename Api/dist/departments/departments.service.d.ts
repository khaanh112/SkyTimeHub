import { Repository } from 'typeorm';
import { Department } from './departments.entity';
export declare class DepartmentsService {
    private departmentsRepository;
    constructor(departmentsRepository: Repository<Department>);
    findAll(): Promise<Department[]>;
    findOne(id: number): Promise<Department | null>;
    findByName(name: string): Promise<Department | null>;
}
