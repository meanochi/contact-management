import { Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

// UX-DR6: a composed Stack (icon + contextual sentence + one primary action),
// never a single generic Mantine component. Shared because every list screen
// in this app needs one (Story 1.4 is the first, Contacts reuses it later).
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Stack align="center" gap="xs" py="xl">
      <Text fz={40} c="dimmed" aria-hidden="true">
        {icon}
      </Text>
      <Title order={4}>{title}</Title>
      {description && (
        <Text c="dimmed" ta="center" maw={360}>
          {description}
        </Text>
      )}
      {action}
    </Stack>
  );
}
