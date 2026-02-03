import { User } from '../users/users.entity';
export declare class Department {
    id: number;
    name: string;
    description: string;
    leaderId: number;
    leader: User;
    employees: User[];
    createdAt: Date;
    updatedAt: Date;
}
