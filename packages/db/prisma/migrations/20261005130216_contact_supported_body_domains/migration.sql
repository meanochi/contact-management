-- CreateTable
CREATE TABLE "ContactOnSupportedBodyDomain" (
    "contact_id" TEXT NOT NULL,
    "supported_body_id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,

    CONSTRAINT "ContactOnSupportedBodyDomain_pkey" PRIMARY KEY ("contact_id","supported_body_id","domain_id")
);

-- CreateIndex
CREATE INDEX "ContactOnSupportedBodyDomain_domain_id_idx" ON "ContactOnSupportedBodyDomain"("domain_id");

-- AddForeignKey
ALTER TABLE "ContactOnSupportedBodyDomain" ADD CONSTRAINT "ContactOnSupportedBodyDomain_contact_id_supported_body_id_fkey" FOREIGN KEY ("contact_id", "supported_body_id") REFERENCES "ContactOnSupportedBody"("contact_id", "supported_body_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactOnSupportedBodyDomain" ADD CONSTRAINT "ContactOnSupportedBodyDomain_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
