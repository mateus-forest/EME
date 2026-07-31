CREATE TABLE "UserTrustedDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "browser" TEXT,
  "platform" TEXT,
  "userAgent" TEXT,
  "biometricEnabled" BOOLEAN NOT NULL DEFAULT false,
  "pinFailures" INTEGER NOT NULL DEFAULT 0,
  "lastAccessAt" TIMESTAMP(3),
  "lastPasswordLoginAt" TIMESTAMP(3),
  "lastPinLoginAt" TIMESTAMP(3),
  "lastBiometricLoginAt" TIMESTAMP(3),
  "trustedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserTrustedDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPasskeyCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "publicKey" BYTEA NOT NULL,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "transports" JSONB,
  "deviceType" TEXT,
  "backedUp" BOOLEAN NOT NULL DEFAULT false,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserPasskeyCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserTrustedDevice_tokenHash_key" ON "UserTrustedDevice"("tokenHash");
CREATE INDEX "UserTrustedDevice_userId_revokedAt_idx" ON "UserTrustedDevice"("userId", "revokedAt");
CREATE INDEX "UserTrustedDevice_userId_lastAccessAt_idx" ON "UserTrustedDevice"("userId", "lastAccessAt");

CREATE UNIQUE INDEX "UserPasskeyCredential_credentialId_key" ON "UserPasskeyCredential"("credentialId");
CREATE INDEX "UserPasskeyCredential_userId_deviceId_idx" ON "UserPasskeyCredential"("userId", "deviceId");

ALTER TABLE "UserTrustedDevice"
ADD CONSTRAINT "UserTrustedDevice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPasskeyCredential"
ADD CONSTRAINT "UserPasskeyCredential_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPasskeyCredential"
ADD CONSTRAINT "UserPasskeyCredential_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "UserTrustedDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
