-- Additive only: new audit action for permanent task deletion.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TASK_DELETED';
