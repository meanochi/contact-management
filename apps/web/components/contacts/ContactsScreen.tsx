"use client";

import { useState } from "react";
import { Drawer, Button, Group } from "@mantine/core";
import type { ContactDto } from "@contact-management/shared-schemas/contacts";
import { ContactForm } from "./ContactForm";
import { ContactEditDrawer } from "./ContactEditDrawer";
import { ContactsList } from "./ContactsList";

// Mirrors SupportedBodiesScreen — owns the "create" Drawer's open state at
// the screen level so both the toolbar button and the Empty State's action
// (UX-DR6) open the same Drawer. Story 1.6 — "editing" is owned here too,
// same reason: set from a row click inside ContactsList but rendered as a
// sibling Drawer, not nested inside the list component.
export function ContactsScreen() {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ContactDto | null>(null);

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button onClick={() => setCreating(true)}>איש קשר חדש</Button>
      </Group>

      <ContactsList onCreateNew={() => setCreating(true)} onRowClick={setEditing} />

      {/* Content Drawer direction (UX-DR7): opens from the left. */}
      <Drawer opened={creating} onClose={() => setCreating(false)} position="left" title="איש קשר חדש">
        <ContactForm onSuccess={() => setCreating(false)} />
      </Drawer>

      <ContactEditDrawer contact={editing} onClose={() => setEditing(null)} />
    </>
  );
}
