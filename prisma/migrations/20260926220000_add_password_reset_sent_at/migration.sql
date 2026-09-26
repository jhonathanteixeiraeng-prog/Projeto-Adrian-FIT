-- "Esqueci minha senha": when the last reset e-mail was sent (throttling).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetSentAt" TIMESTAMP(3);
