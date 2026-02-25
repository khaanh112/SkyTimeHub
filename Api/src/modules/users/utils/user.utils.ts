import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { User } from '@entities/users.entity';

/**
 * Generate employee ID with format: SG{number}
 * Finds the max existing SG number and increments by 1.
 * Example: if max is SG101, generates SG102.
 */
export async function generateEmployeeId(usersRepository: Repository<User>): Promise<string> {
  const prefix = 'SG';

  const latestUser = await usersRepository
    .createQueryBuilder('user')
    .where('user.employee_id LIKE :prefix', { prefix: `${prefix}%` })
    .orderBy(
      `CAST(SUBSTRING(user.employee_id FROM ${prefix.length + 1}) AS INTEGER)`,
      'DESC',
    )
    .getOne();

  let nextNumber = 1;
  if (latestUser && latestUser.employeeId) {
    const numPart = parseInt(latestUser.employeeId.substring(prefix.length), 10);
    if (!isNaN(numPart)) {
      nextNumber = numPart + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}

/**
 * Generate activation token for new users
 * Returns a 64-character hexadecimal string
 */
export function generateActivationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
