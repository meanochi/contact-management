import { MultiSelect, type MultiSelectProps } from "@mantine/core";

export interface DomainOption {
  id: string;
  name: string;
}

export interface DomainMultiSelectProps
  extends Omit<MultiSelectProps, "data" | "value" | "onChange"> {
  domains: DomainOption[];
  value: string[];
  onChange: (domainIds: string[]) => void;
}

// Presentational only — packages/ui cannot depend on apps/web's RTK Query
// hooks (ARCHITECTURE-SPINE.md AD-11: packages never import from apps). The
// caller (apps/web) fetches domains (useListActiveDomainsQuery) and passes
// them in as `domains`. Reused by Story 1.3 (edit SupportedBody).
export function DomainMultiSelect({ domains, value, onChange, ...rest }: DomainMultiSelectProps) {
  return (
    <MultiSelect
      label='תחום'
      placeholder={domains.length ? "בחר/י תחום אחד או יותר" : "אין תחומים זמינים"}
      data={domains.map((d) => ({ value: d.id, label: d.name }))}
      value={value}
      onChange={onChange}
      searchable
      {...rest}
    />
  );
}
