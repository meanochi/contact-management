"use client";

import { AppShell as MantineAppShell, Burger, Group, NavLink, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Story 1.5 — nav links added now that there are two real screens to switch
// between (Story 1.1's placeholder comment said this would happen once that
// was true).
const NAV_ITEMS = [
  { href: "/supported-bodies", label: "גופים נתמכים" },
  { href: "/contacts", label: "אנשי קשר" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const pathname = usePathname();

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

      <MantineAppShell.Navbar p="md">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            component={Link}
            href={item.href}
            label={item.label}
            active={pathname === item.href}
          />
        ))}
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}
