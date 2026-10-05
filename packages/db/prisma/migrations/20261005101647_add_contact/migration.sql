-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ExternalRequestSource" AS ENUM ('PHONE', 'EMAIL', 'OTHER');

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "id_number" TEXT,
    "role" TEXT,
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phone" TEXT,
    "notes" TEXT,
    "email_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "sms_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "deactivated_at" TIMESTAMP(3),
    "external_request_source" "ExternalRequestSource",
    "external_request_date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactOnSupportedBody" (
    "contact_id" TEXT NOT NULL,
    "supported_body_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactOnSupportedBody_pkey" PRIMARY KEY ("contact_id","supported_body_id")
);

-- CreateIndex
CREATE INDEX "Contact_status_idx" ON "Contact"("status");

-- CreateIndex
CREATE INDEX "ContactOnSupportedBody_supported_body_id_idx" ON "ContactOnSupportedBody"("supported_body_id");

-- AddForeignKey
ALTER TABLE "ContactOnSupportedBody" ADD CONSTRAINT "ContactOnSupportedBody_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactOnSupportedBody" ADD CONSTRAINT "ContactOnSupportedBody_supported_body_id_fkey" FOREIGN KEY ("supported_body_id") REFERENCES "SupportedBody"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
