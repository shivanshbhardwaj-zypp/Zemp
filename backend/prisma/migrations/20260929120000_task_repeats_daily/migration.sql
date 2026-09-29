-- A daily repeating task: additive only, existing rows default to not repeating.
ALTER TABLE "Task" ADD COLUMN "repeatsDaily" BOOLEAN NOT NULL DEFAULT false;
