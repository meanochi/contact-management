// Story 1.2: read-only DTO — no create/edit schema in this story (no domain
// management screen in Epic 1, ARCHITECTURE-SPINE.md Deferred).
export interface DomainDto {
  id: string;
  name: string;
  isActive: boolean;
}
