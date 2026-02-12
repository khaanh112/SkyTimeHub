import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { User } from '@entities/users.entity';

/**
 * Generate employee ID with format: EMP{YY}{0000}
 * Example: EMP2401, EMP2402, etc.
 */
export async function generateEmployeeId(
  usersRepository: Repository<User>,
): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = `EMP${year}`;

  const latestUser = await usersRepository
    .createQueryBuilder('user')
    .where('user.employee_id LIKE :prefix', { prefix: `${prefix}%` })
    .orderBy('user.employee_id', 'DESC')
    .getOne();

  let nextNumber = 1;
  if (latestUser && latestUser.employeeId) {
    const lastNumber = parseInt(latestUser.employeeId.slice(-4));
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

/**
 * Generate activation token for new users
 * Returns a 64-character hexadecimal string
 */
export function generateActivationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
