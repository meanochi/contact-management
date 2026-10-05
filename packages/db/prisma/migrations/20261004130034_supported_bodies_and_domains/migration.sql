-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportedBody" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportedBody_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportedBodyOnDomain" (
    "supported_body_id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportedBodyOnDomain_pkey" PRIMARY KEY ("supported_body_id","domain_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Domain_name_key" ON "Domain"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SupportedBody_company_id_key" ON "SupportedBody"("company_id");

-- CreateIndex
CREATE INDEX "SupportedBodyOnDomain_domain_id_idx" ON "SupportedBodyOnDomain"("domain_id");

-- AddForeignKey
ALTER TABLE "SupportedBodyOnDomain" ADD CONSTRAINT "SupportedBodyOnDomain_supported_body_id_fkey" FOREIGN KEY ("supported_body_id") REFERENCES "SupportedBody"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportedBodyOnDomain" ADD CONSTRAINT "SupportedBodyOnDomain_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
