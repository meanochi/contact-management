import { randomUUID } from "node:crypto";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  foreignKey,
} from "drizzle-orm/pg-core";

// Table and column names match the pre-Drizzle (Prisma) database exactly, so
// the schema describes the same physical tables the app has always used.

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

const createdAt = () => timestamp("createdAt", { precision: 3 }).defaultNow().notNull();
// The app supplies updatedAt itself on insert ($defaultFn) rather than relying
// on a database default: tables created by the old Prisma migrations have no
// DEFAULT on this column (Prisma filled it in client-side), so an insert that
// omitted it failed with a NOT NULL violation.
const updatedAt = () =>
  timestamp("updatedAt", { precision: 3 })
    .defaultNow()
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

export const contactStatus = pgEnum("ContactStatus", ["ACTIVE", "INACTIVE"]);

// Story 1.7: which channel an out-of-system update/removal request came in on.
export const externalRequestSource = pgEnum("ExternalRequestSource", ["PHONE", "EMAIL", "OTHER"]);

export const auditLogs = pgTable(
  "AuditLog",
  {
    id: id(),
    tableName: text("table_name").notNull(),
    recordId: text("record_id").notNull(),
    action: text("action").notNull(), // "CREATE" | "UPDATE" | "DELETE"
    before: jsonb("before"),
    after: jsonb("after"),
    changedById: text("changed_by_id"),
    changedAt: timestamp("changedAt", { precision: 3 }).defaultNow().notNull(),
  },
  (t) => [index("AuditLog_table_name_record_id_idx").on(t.tableName, t.recordId), index("AuditLog_changed_by_id_idx").on(t.changedById)],
);

// Story 1.2. Admin-managed lookup table — a real table, not a pg enum, so
// domains can be added/renamed/deactivated at runtime without a migration.
export const domains = pgTable("Domain", {
  id: id(),
  name: text("name").notNull().unique("Domain_name_key"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Story 1.2. companyId (ח"פ) is the natural business key — unique at the DB
// level, not just app-level, so a race can't bypass it.
export const supportedBodies = pgTable("SupportedBody", {
  id: id(),
  companyId: text("company_id").notNull().unique("SupportedBody_company_id_key"),
  name: text("name").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Explicit join table: a body can belong to more than one domain.
export const supportedBodyDomains = pgTable(
  "SupportedBodyOnDomain",
  {
    supportedBodyId: text("supported_body_id")
      .notNull()
      .references(() => supportedBodies.id),
    domainId: text("domain_id")
      .notNull()
      .references(() => domains.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.supportedBodyId, t.domainId] }), index("SupportedBodyOnDomain_domain_id_idx").on(t.domainId)],
);

// Story 1.5. firstName/lastName kept separate — the create form collects two
// distinct inputs. idNumber (ת"ז) format validation lives in
// packages/shared-schemas, not the column. No direct domainId: a Contact
// reaches a domain only through the SupportedBody it is linked to.
export const contacts = pgTable(
  "Contact",
  {
    id: id(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    idNumber: text("id_number"),
    role: text("role"),
    emails: text("emails").array().notNull().default([]), // FR-10: more than one address per contact
    phone: text("phone"),
    notes: text("notes"),
    emailOptIn: boolean("email_opt_in").default(false).notNull(),
    smsOptIn: boolean("sms_opt_in").default(false).notNull(),
    status: contactStatus("status").default("ACTIVE").notNull(),
    deactivatedAt: timestamp("deactivated_at", { precision: 3 }),
    // Story 1.7: set together whenever a status change came from outside the app.
    externalRequestSource: externalRequestSource("external_request_source"),
    externalRequestDate: timestamp("external_request_date", { precision: 3 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("Contact_status_idx").on(t.status)],
);

export const contactSupportedBodies = pgTable(
  "ContactOnSupportedBody",
  {
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id),
    supportedBodyId: text("supported_body_id")
      .notNull()
      .references(() => supportedBodies.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.supportedBodyId] }), index("ContactOnSupportedBody_supported_body_id_idx").on(t.supportedBodyId)],
);

// The subset of a linked body's own domains this contact actually represents.
// Subset-of-body's-domains is enforced in the service layer (the schema can't
// express it); there is no FK back to SupportedBodyOnDomain.
export const contactSupportedBodyDomains = pgTable(
  "ContactOnSupportedBodyDomain",
  {
    contactId: text("contact_id").notNull(),
    supportedBodyId: text("supported_body_id").notNull(),
    domainId: text("domain_id")
      .notNull()
      .references(() => domains.id),
  },
  (t) => [
    primaryKey({ columns: [t.contactId, t.supportedBodyId, t.domainId] }),
    foreignKey({
      columns: [t.contactId, t.supportedBodyId],
      foreignColumns: [contactSupportedBodies.contactId, contactSupportedBodies.supportedBodyId],
      name: "ContactOnSupportedBodyDomain_contact_link_fkey",
    }),
    index("ContactOnSupportedBodyDomain_domain_id_idx").on(t.domainId),
  ],
);

export const supportedBodiesRelations = relations(supportedBodies, ({ many }) => ({
  domains: many(supportedBodyDomains),
  contacts: many(contactSupportedBodies),
}));

export const supportedBodyDomainsRelations = relations(supportedBodyDomains, ({ one }) => ({
  supportedBody: one(supportedBodies, { fields: [supportedBodyDomains.supportedBodyId], references: [supportedBodies.id] }),
  domain: one(domains, { fields: [supportedBodyDomains.domainId], references: [domains.id] }),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  supportedBodies: many(contactSupportedBodies),
}));

export const contactSupportedBodiesRelations = relations(contactSupportedBodies, ({ one, many }) => ({
  contact: one(contacts, { fields: [contactSupportedBodies.contactId], references: [contacts.id] }),
  supportedBody: one(supportedBodies, { fields: [contactSupportedBodies.supportedBodyId], references: [supportedBodies.id] }),
  domains: many(contactSupportedBodyDomains),
}));

export const contactSupportedBodyDomainsRelations = relations(contactSupportedBodyDomains, ({ one }) => ({
  link: one(contactSupportedBodies, {
    fields: [contactSupportedBodyDomains.contactId, contactSupportedBodyDomains.supportedBodyId],
    references: [contactSupportedBodies.contactId, contactSupportedBodies.supportedBodyId],
  }),
  domain: one(domains, { fields: [contactSupportedBodyDomains.domainId], references: [domains.id] }),
}));
