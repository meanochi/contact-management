"use client";

import { useState } from "react";
import { Modal, Select, Button, Stack, Group } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import type { ExternalRequestSource } from "@contact-management/shared-schemas/contacts";
import { useDeactivateContactMutation } from "@/lib/api/contactsApi";

const SOURCE_OPTIONS: { value: ExternalRequestSource; label: string }[] = [
  { value: "PHONE", label: "טלפון" },
  { value: "EMAIL", label: 'דוא"ל' },
  { value: "OTHER", label: "אחר" },
];

// UX-DR13 — a dedicated confirm Modal, not an immediate status toggle:
// deactivating a Contact always requires documenting where/when the
// request came from (FR-9).
export function MarkInactiveModal({
  opened,
  contactId,
  onClose,
  onDeactivated,
}: {
  opened: boolean;
  contactId: string;
  onClose: () => void;
  onDeactivated: () => void;
}) {
  const [source, setSource] = useState<ExternalRequestSource | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [deactivateContact, { isLoading }] = useDeactivateContactMutation();

  const reset = () => {
    setSource(null);
    setDate(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = async () => {
    if (!source || !date) return;
    try {
      await deactivateContact({ id: contactId, input: { source, date } }).unwrap();
      reset();
      onDeactivated();
    } catch {
      notifications.show({ color: "red", title: "שגיאה", message: "הסימון ככלא פעיל נכשל — נסה/י שוב" });
    }
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="סימון איש קשר כלא פעיל">
      <Stack gap="md">
        <Select
          label="מקור הבקשה"
          placeholder="בחר/י מקור"
          required
          data={SOURCE_OPTIONS}
          value={source}
          onChange={(value) => setSource(value as ExternalRequestSource | null)}
        />
        <DateInput label="תאריך הבקשה" placeholder="בחר/י תאריך" required value={date} onChange={setDate} />
        <Group justify="flex-end">
          <Button type="button" variant="default" onClick={handleClose}>
            ביטול
          </Button>
          <Button type="button" color="red" disabled={!source || !date} loading={isLoading} onClick={handleConfirm}>
            אישור וסימון
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
