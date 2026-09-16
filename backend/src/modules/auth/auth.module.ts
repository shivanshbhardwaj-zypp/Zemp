import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';

/**
 * Global because the auth guard needs `SessionService` on every request, and the users module
 * issues reset tokens through `AuthService` when an admin resets someone's access.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
