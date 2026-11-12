-- Additive only: new audit action for permanent account deletion.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_DELETED';
