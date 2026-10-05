import { Chip, Group, Text } from "@mantine/core";
import type { DomainOption } from "./DomainMultiSelect";

export interface SupportedBodyDomainsPickerProps {
  // Only the chosen SupportedBody's own domains — the caller is responsible
  // for narrowing this down (packages/ui stays presentational, AD-11).
  domains: DomainOption[];
  value: string[];
  onChange: (domainIds: string[]) => void;
}

// Post-1.6 revision: a Contact linked to a multi-domain SupportedBody isn't
// necessarily the contact person for *every* one of that body's domains.
// Pre-filled with all of them (caller's job — see ContactForm/ContactEditDrawer),
// rendered as removable pills so unchecking one narrows the subset.
export function SupportedBodyDomainsPicker({ domains, value, onChange }: SupportedBodyDomainsPickerProps) {
  if (domains.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        בחר/י גוף נתמך כדי לראות את התחומים שלו
      </Text>
    );
  }

  return (
    <Chip.Group multiple value={value} onChange={onChange}>
      <Group gap="xs">
        {domains.map((d) => (
          <Chip key={d.id} value={d.id}>
            {d.name}
          </Chip>
        ))}
      </Group>
    </Chip.Group>
  );
}
