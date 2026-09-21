import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  changePasswordSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  type ChangePasswordInput,
  type LoginInput,
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
  type SessionUser,
} from '@zemp/shared';
import type { Response } from 'express';
import { ClientInfo, CurrentUser, Now, Public } from '../../common/auth.js';
import { zodPipe } from '../../common/http.js';
import type { SeedUser } from '../../data/store.service.js';
import { AuthService, type ClientContext } from './auth.service.js';
import { CurrentSession } from './session.decorator.js';
import { SessionService, type Session } from './session.service.js';

/**
 * Credential endpoints are rate limited far more tightly than the rest of the API. The override key
 * must match the throttler's registered `name` ("default" in AppModule) — @nestjs/throttler looks up
 * the override as `THROTTLER_LIMIT:<name>`, so any other key is silently ignored and the endpoint
 * falls back to the global limit.
 */
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in and start a session' })
  async login(
    @Body(zodPipe(loginSchema)) input: LoginInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionUser> {
    const { user, session } = await this.auth.login(input, client, now);
    this.sessions.attach(response, session);
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End the current session' })
  async logout(
    @CurrentUser() user: SeedUser,
    @CurrentSession() session: Session,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    await this.auth.logout(user, session, client, now);
    this.sessions.clear(response);
    return null;
  }

  @Get('me')
  @ApiOperation({ summary: 'The signed-in user, their role, permissions and scope' })
  me(@CurrentUser() user: SeedUser): SessionUser {
    return this.auth.me(user);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change your own password; signs out other sessions' })
  async changePassword(
    @CurrentUser() user: SeedUser,
    @CurrentSession() session: Session,
    @Body(zodPipe(changePasswordSchema)) input: ChangePasswordInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<null> {
    await this.auth.changePassword(user, session, input, client, now);
    return null;
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a reset link (always succeeds, to avoid revealing accounts)' })
  async requestReset(
    @Body(zodPipe(passwordResetRequestSchema)) input: PasswordResetRequestInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<null> {
    await this.auth.requestPasswordReset(input, client, now);
    return null;
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password with a reset token' })
  async confirmReset(
    @Body(zodPipe(passwordResetConfirmSchema)) input: PasswordResetConfirmInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<null> {
    await this.auth.confirmPasswordReset(input, client, now);
    return null;
  }
}
