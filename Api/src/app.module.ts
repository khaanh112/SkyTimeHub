import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { getDatabaseConfig } from './config/database.config';
import { AppController } from './app.controller';
// Feature Modules
import { UsersModule } from '@modules/users/users.module';
import { AuthenticationModule } from '@modules/authentication/authentication.module';
import { AuthorizationModule } from '@modules/authorization/authorization.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { LeaveRequestsModule } from '@modules/leave-requests/leave-requests.module';

import { JwtAuthGuard } from '@modules/authentication/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/authorization/guards/roles.guard';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: './.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    ScheduleModule.forRoot(), // Enable cron jobs for email worker
    UsersModule,
    AuthenticationModule,
    AuthorizationModule,
    NotificationsModule,
    LeaveRequestsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    // Global Interceptor - Transform Response
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Global Guard - Authentication (must run first)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Guard - Authorization (RBAC)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
