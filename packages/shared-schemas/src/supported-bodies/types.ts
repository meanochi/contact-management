export interface CreateSupportedBodyInput {
  name: string;
  companyId: string; // ח"פ
  domainIds: string[]; // at least one — Story 1.2
}

// Story 1.3: PATCH body — every field optional (partial update), but at
// least one must be present (enforced in the Joi schema, not the type).
export interface UpdateSupportedBodyInput {
  name?: string;
  companyId?: string;
  domainIds?: string[];
  isActive?: boolean;
}

export interface SupportedBodyDto {
  id: string;
  name: string;
  companyId: string;
  isActive: boolean;
  domainIds: string[];
}

// Story 1.4: GET /supported-bodies query params. "status" (UX wording) maps
// onto the actual `isActive` boolean column — SupportedBody has no separate
// status enum (unlike Contact). Page numbers are 1-based.
export interface ListSupportedBodiesQuery {
  search?: string;
  domainId?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

export interface ListSupportedBodiesResult {
  items: SupportedBodyDto[];
  total: number;
  page: number;
  pageSize: number;
}
