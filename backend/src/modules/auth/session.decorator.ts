import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { DomainError } from '@zemp/shared';
import type { RequestContext } from '../../common/auth.js';
import type { Session } from './session.service.js';

/** The session the guard resolved for this request. Separate from `@CurrentUser()` to avoid a cycle. */
export const CurrentSession = createParamDecorator((_data: unknown, context: ExecutionContext): Session => {
  const request = context.switchToHttp().getRequest<RequestContext>();
  if (!request.session) throw new DomainError('UNAUTHENTICATED');
  return request.session;
});
