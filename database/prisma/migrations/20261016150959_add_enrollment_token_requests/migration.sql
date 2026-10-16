-- CreateTable
CREATE TABLE "enrollment_token_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "requestNote" TEXT NOT NULL DEFAULT '',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT NOT NULL DEFAULT '',
    "issuedTokenId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "tokenRevealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollment_token_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_token_requests_issuedTokenId_key" ON "enrollment_token_requests"("issuedTokenId");

-- CreateIndex
CREATE INDEX "enrollment_token_requests_organizationId_idx" ON "enrollment_token_requests"("organizationId");

-- CreateIndex
CREATE INDEX "enrollment_token_requests_organizationId_status_idx" ON "enrollment_token_requests"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "enrollment_token_requests" ADD CONSTRAINT "enrollment_token_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_token_requests" ADD CONSTRAINT "enrollment_token_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_token_requests" ADD CONSTRAINT "enrollment_token_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_token_requests" ADD CONSTRAINT "enrollment_token_requests_issuedTokenId_fkey" FOREIGN KEY ("issuedTokenId") REFERENCES "enrollment_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
