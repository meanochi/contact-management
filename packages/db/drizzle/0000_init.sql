CREATE TYPE "public"."ContactStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."ExternalRequestSource" AS ENUM('PHONE', 'EMAIL', 'OTHER');--> statement-breakpoint
CREATE TABLE "AuditLog" (
	"id" text PRIMARY KEY NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"changed_by_id" text,
	"changedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ContactOnSupportedBody" (
	"contact_id" text NOT NULL,
	"supported_body_id" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "ContactOnSupportedBody_contact_id_supported_body_id_pk" PRIMARY KEY("contact_id","supported_body_id")
);
--> statement-breakpoint
CREATE TABLE "ContactOnSupportedBodyDomain" (
	"contact_id" text NOT NULL,
	"supported_body_id" text NOT NULL,
	"domain_id" text NOT NULL,
	CONSTRAINT "ContactOnSupportedBodyDomain_contact_id_supported_body_id_domain_id_pk" PRIMARY KEY("contact_id","supported_body_id","domain_id")
);
--> statement-breakpoint
CREATE TABLE "Contact" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"id_number" text,
	"role" text,
	"emails" text[] DEFAULT '{}' NOT NULL,
	"phone" text,
	"notes" text,
	"email_opt_in" boolean DEFAULT false NOT NULL,
	"sms_opt_in" boolean DEFAULT false NOT NULL,
	"status" "ContactStatus" DEFAULT 'ACTIVE' NOT NULL,
	"deactivated_at" timestamp (3),
	"external_request_source" "ExternalRequestSource",
	"external_request_date" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Domain" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "Domain_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "SupportedBody" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "SupportedBody_company_id_key" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "SupportedBodyOnDomain" (
	"supported_body_id" text NOT NULL,
	"domain_id" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "SupportedBodyOnDomain_supported_body_id_domain_id_pk" PRIMARY KEY("supported_body_id","domain_id")
);
--> statement-breakpoint
ALTER TABLE "ContactOnSupportedBody" ADD CONSTRAINT "ContactOnSupportedBody_contact_id_Contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."Contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ContactOnSupportedBody" ADD CONSTRAINT "ContactOnSupportedBody_supported_body_id_SupportedBody_id_fk" FOREIGN KEY ("supported_body_id") REFERENCES "public"."SupportedBody"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ContactOnSupportedBodyDomain" ADD CONSTRAINT "ContactOnSupportedBodyDomain_domain_id_Domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."Domain"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ContactOnSupportedBodyDomain" ADD CONSTRAINT "ContactOnSupportedBodyDomain_contact_link_fkey" FOREIGN KEY ("contact_id","supported_body_id") REFERENCES "public"."ContactOnSupportedBody"("contact_id","supported_body_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SupportedBodyOnDomain" ADD CONSTRAINT "SupportedBodyOnDomain_supported_body_id_SupportedBody_id_fk" FOREIGN KEY ("supported_body_id") REFERENCES "public"."SupportedBody"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SupportedBodyOnDomain" ADD CONSTRAINT "SupportedBodyOnDomain_domain_id_Domain_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."Domain"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "AuditLog_table_name_record_id_idx" ON "AuditLog" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "AuditLog_changed_by_id_idx" ON "AuditLog" USING btree ("changed_by_id");--> statement-breakpoint
CREATE INDEX "ContactOnSupportedBody_supported_body_id_idx" ON "ContactOnSupportedBody" USING btree ("supported_body_id");--> statement-breakpoint
CREATE INDEX "ContactOnSupportedBodyDomain_domain_id_idx" ON "ContactOnSupportedBodyDomain" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "Contact_status_idx" ON "Contact" USING btree ("status");--> statement-breakpoint
CREATE INDEX "SupportedBodyOnDomain_domain_id_idx" ON "SupportedBodyOnDomain" USING btree ("domain_id");