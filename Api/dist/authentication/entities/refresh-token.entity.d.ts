import { User } from '../../users/users.entity';
export declare class RefreshToken {
    id: number;
    token: string;
    userId: number;
    user: User;
    expiresAt: Date;
    isRevoked: boolean;
    createdAt: Date;
}
