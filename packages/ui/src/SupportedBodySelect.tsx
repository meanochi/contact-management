import { Select, type SelectProps } from "@mantine/core";

export interface SupportedBodyOption {
  id: string;
  name: string;
}

export interface SupportedBodySelectProps extends Omit<SelectProps, "data" | "value" | "onChange"> {
  supportedBodies: SupportedBodyOption[];
  value: string | null;
  onChange: (supportedBodyId: string | null) => void;
}

// Presentational only — packages/ui cannot depend on apps/web's RTK Query
// hooks (ARCHITECTURE-SPINE.md AD-11: packages never import from apps). The
// caller (apps/web) fetches supported bodies and passes them in as
// `supportedBodies`. Story 1.5, reused by Story 1.6 (link to another body).
export function SupportedBodySelect({ supportedBodies, value, onChange, ...rest }: SupportedBodySelectProps) {
  return (
    <Select
      label="גוף נתמך"
      placeholder={supportedBodies.length ? "בחר/י גוף נתמך" : "אין גופים נתמכים זמינים"}
      data={supportedBodies.map((b) => ({ value: b.id, label: b.name }))}
      value={value}
      onChange={onChange}
      searchable
      {...rest}
    />
  );
}
