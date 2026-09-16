/** API error codes and their HTTP status. The frontend maps codes to messages (Frontend.md §148). */
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  INVALID_REFERENCE: 400,
  INVALID_RESET_TOKEN: 400,
  INVALID_CURRENT_PASSWORD: 400,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_INACTIVE: 403,
  FORBIDDEN: 403,
  CSRF_INVALID: 403,
  ASSIGNEE_OUT_OF_SCOPE: 403,
  NOT_FOUND: 404,
  TASK_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  TEAM_NOT_FOUND: 404,
  NOTIFICATION_NOT_FOUND: 404,
  CONFLICT: 409,
  EMAIL_TAKEN: 409,
  EMPLOYEE_CODE_TAKEN: 409,
  TEAM_NAME_TAKEN: 409,
  INVALID_STATUS_TRANSITION: 422,
  TASK_NOT_EDITABLE: 422,
  INVALID_PROGRESS: 422,
  INVALID_DUE_DATE: 422,
  ASSIGNEE_INACTIVE: 422,
  INVALID_TEAM: 422,
  TEAM_HAS_ACTIVE_MEMBERS: 422,
  CANNOT_CHANGE_OWN_ACCOUNT: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Please correct the highlighted fields.',
  INVALID_REFERENCE: 'A referenced record does not exist.',
  INVALID_RESET_TOKEN: 'This password reset link is invalid or has expired.',
  INVALID_CURRENT_PASSWORD: 'Your current password is incorrect.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  ACCOUNT_INACTIVE: 'This account is inactive. Contact your administrator.',
  FORBIDDEN: "You don't have permission to perform this action.",
  CSRF_INVALID: 'Your session could not be verified. Refresh the page and try again.',
  ASSIGNEE_OUT_OF_SCOPE: 'You can only assign work to people within your scope.',
  NOT_FOUND: 'This item could not be found.',
  TASK_NOT_FOUND: 'This task no longer exists or is not available to you.',
  USER_NOT_FOUND: 'This person could not be found.',
  TEAM_NOT_FOUND: 'This team could not be found.',
  NOTIFICATION_NOT_FOUND: 'This notification could not be found.',
  CONFLICT: 'This change conflicts with existing data.',
  EMAIL_TAKEN: 'An account with this email already exists.',
  EMPLOYEE_CODE_TAKEN: 'This employee ID is already in use.',
  TEAM_NAME_TAKEN: 'A team with this name already exists.',
  INVALID_STATUS_TRANSITION: 'This status change is not allowed.',
  TASK_NOT_EDITABLE: 'Completed or cancelled tasks cannot be changed.',
  INVALID_PROGRESS: 'Progress must be a whole number from 0 to 100.',
  INVALID_DUE_DATE: 'Choose a due date in the future.',
  ASSIGNEE_INACTIVE: 'Inactive people cannot receive new tasks.',
  INVALID_TEAM: 'Choose a valid team for this assignment.',
  TEAM_HAS_ACTIVE_MEMBERS: 'Move active members out of this team first.',
  CANNOT_CHANGE_OWN_ACCOUNT: 'You cannot change your own account this way.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
};

/** A business-rule violation. Thrown by domain rules; the API layer turns it into the error envelope. */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string = ERROR_MESSAGES[code], details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}
