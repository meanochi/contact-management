"use client";

import { AppShell as MantineAppShell, Burger, Group, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

// Story 1.1: empty shell only (Sidebar + content area), no auth gate — shown
// directly to anyone who opens apps/web. Sidebar content itself (nav links)
// is added once there are real screens to link to, starting Story 1.2+.
export function AppShell({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();

  return (
    <MantineAppShell
      padding="md"
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened } }}
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Text fw={700}>ניהול אנשי קשר</Text>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="md">{/* Sidebar — ריק בשלב זה */}</MantineAppShell.Navbar>

      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}
