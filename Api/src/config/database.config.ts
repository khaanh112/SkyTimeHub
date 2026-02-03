import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../entity/users.entity';
import { RefreshToken } from '../entity/refresh-token.entity';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST'),
  port: configService.get('DB_PORT'),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_DATABASE'),
  entities: [User, RefreshToken],
  synchronize: configService.get('DB_SYNCHRONIZE') === 'true',
  logging: configService.get('DB_LOGGING') === 'true',
});
