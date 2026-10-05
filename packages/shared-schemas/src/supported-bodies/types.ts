export interface CreateSupportedBodyInput {
  name: string;
  companyId: string; // ח"פ
  domainIds: string[]; // at least one — Story 1.2
}

export interface SupportedBodyDto {
  id: string;
  name: string;
  companyId: string;
  isActive: boolean;
  domainIds: string[];
}
