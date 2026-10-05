// Story 1.5. firstName/lastName kept separate (not one combined field) —
// confirmed with Rachel: the create form collects them as two distinct
// inputs. idNumber (ת"ז) is optional free text, no format validation.
export interface CreateContactInput {
  firstName: string;
  lastName: string;
  idNumber?: string;
  role?: string;
  phone?: string;
  emails: string[]; // FR-10: at least one, more than one supported
  notes?: string;
  emailOptIn: boolean;
  smsOptIn: boolean;
  supportedBodyId: string; // required — a contact always belongs to at least one body
  // Post-1.6 revision (confirmed with Rachel): which of supportedBodyId's own
  // domains this contact actually represents — must be a non-empty subset of
  // that body's domains, not necessarily all of them. The UI pre-fills every
  // domain of the chosen body and lets the user deselect some.
  domainIds: string[];
}

// Story 1.6 — PATCH body. Deliberately excludes firstName/lastName/idNumber
// (not editable per this story's AC — confirmed with Rachel) and
// supportedBodyId (handled by its own AddSupportedBodyInput endpoint instead,
// since linking a second body is additive, not a field replacement).
export interface UpdateContactInput {
  role?: string;
  phone?: string;
  emails?: string[];
  notes?: string;
  emailOptIn?: boolean;
  smsOptIn?: boolean;
}

// Story 1.6 — POST /contacts/:id/supported-bodies
export interface AddSupportedBodyInput {
  supportedBodyId: string;
  domainIds: string[]; // same subset rule as CreateContactInput.domainIds
}

// PATCH /contacts/:id/supported-bodies/:supportedBodyId — editing an
// *existing* link's domain subset after the fact (requested by Rachel: the
// subset was otherwise only ever choosable once, at creation/add time).
export interface UpdateSupportedBodyDomainsInput {
  domainIds: string[]; // same subset rule — non-empty, must belong to that SupportedBody
}

export type ExternalRequestSource = "PHONE" | "EMAIL" | "OTHER";

// Story 1.7 — POST /contacts/:id/deactivate. Both fields always required
// together (not independently optional) — a deactivation without a
// documented source/date would violate FR-9.
export interface DeactivateContactInput {
  source: ExternalRequestSource;
  date: string; // ISO date string
}

// One linked SupportedBody, with the subset of its domains this Contact
// actually represents there.
export interface ContactSupportedBodyLink {
  supportedBodyId: string;
  domainIds: string[];
}

export interface ContactDto {
  id: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  role: string | null;
  phone: string | null;
  emails: string[];
  notes: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  status: "ACTIVE" | "INACTIVE";
  supportedBodyLinks: ContactSupportedBodyLink[]; // many-to-many (Story 1.6 adds more than one)
}

// Story 1.8 — search/filter. `includeInactive` (boolean), not a `status`
// string — matches the AC's actual UI ("checkbox 'כלול לא פעילים'") and the
// same pattern already used for SupportedBody's `isActive` (Story 1.4), not
// the epic task text's loose "status=" placeholder.
export interface ListContactsQuery {
  search?: string;
  supportedBodyId?: string;
  domainId?: string;
  includeInactive?: boolean;
  updatedYear?: number;
  page: number;
  pageSize: number;
}

export interface ListContactsResult {
  items: ContactDto[];
  total: number;
  page: number;
  pageSize: number;
}
