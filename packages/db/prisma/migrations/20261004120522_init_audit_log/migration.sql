-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "changed_by_id" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_table_name_record_id_idx" ON "AuditLog"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "AuditLog_changed_by_id_idx" ON "AuditLog"("changed_by_id");
