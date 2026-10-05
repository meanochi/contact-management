"use client";

import { useState } from "react";
import { Drawer, Button, Group } from "@mantine/core";
import type { SupportedBodyDto } from "@contact-management/shared-schemas/supported-bodies";
import { SupportedBodyForm } from "./SupportedBodyForm";
import { SupportedBodyEditDrawer } from "./SupportedBodyEditDrawer";
import { SupportedBodiesList } from "./SupportedBodiesList";

// Owns the "create" Drawer's open state at the screen level, not inside
// SupportedBodiesList or a standalone trigger button — both the toolbar
// button and the Empty State's "create the first one" action (UX-DR6) need
// to open the same Drawer, so the state has to live above both of them.
// Story 1.3 — "editing" is owned here too, for the same reason: it's set
// from a row click inside SupportedBodiesList but rendered as a sibling
// Drawer, not nested inside the list component.
export function SupportedBodiesScreen() {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SupportedBodyDto | null>(null);

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button onClick={() => setCreating(true)}>גוף נתמך חדש</Button>
      </Group>

      <SupportedBodiesList onCreateNew={() => setCreating(true)} onRowClick={setEditing} />

      {/* Content Drawer direction (UX-DR7): opens from the left. */}
      <Drawer opened={creating} onClose={() => setCreating(false)} position="left" title="גוף נתמך חדש">
        <SupportedBodyForm onSuccess={() => setCreating(false)} />
      </Drawer>

      <SupportedBodyEditDrawer supportedBody={editing} onClose={() => setEditing(null)} />
    </>
  );
}
