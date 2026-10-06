"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import { TextInput, Button, Stack, Alert, Anchor, Drawer, Group, Modal, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { updateSupportedBodySchema } from "@contact-management/shared-schemas/supported-bodies";
import type { SupportedBodyDto } from "@contact-management/shared-schemas/supported-bodies";
import { DomainMultiSelect } from "@contact-management/ui";
import { useListActiveDomainsQuery } from "@/lib/api/domainsApi";
import { useUpdateSupportedBodyMutation } from "@/lib/api/supportedBodiesApi";
import { ContactForm } from "@/components/contacts/ContactForm";

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: { field: string; message: string }[] | { id: string; name: string } | null;
  };
}

// The form itself only ever edits name/companyId/domainIds — deactivate is a
// separate button + confirm Modal below, not a field in this schema.
interface EditFormValues {
  name: string;
  companyId: string;
  domainIds: string[];
}

export function SupportedBodyEditDrawer({
  supportedBody,
  onClose,
}: {
  supportedBody: SupportedBodyDto | null;
  onClose: () => void;
}) {
  const { data: domains = [], isLoading: domainsLoading } = useListActiveDomainsQuery();
  const [updateSupportedBody, { isLoading: isSaving }] = useUpdateSupportedBodyMutation();
  const [conflict, setConflict] = useState<{ message: string; existing?: { id: string; name: string } } | null>(
    null,
  );
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  // Story 1.5 — "add a contact" entry point, pre-filled with this body's id
  // (the AC's "פותח מתוך מסך גוף נתמך, משויך אוטומטית" case). There's no
  // dedicated per-body detail page yet, so this edit Drawer is the closest
  // thing to "a specific supported body's screen".
  const [addingContact, setAddingContact] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isValid },
  } = useForm<EditFormValues>({
    resolver: joiResolver(updateSupportedBodySchema),
    mode: "onChange", // real-time validation, not just on submit — UX-DR12
    defaultValues: { name: "", companyId: "", domainIds: [] },
  });

  // One Drawer instance is reused across every row, so the form has to be
  // re-seeded whenever a different record opens — it can't rely on mount.
  useEffect(() => {
    if (supportedBody) {
      reset({ name: supportedBody.name, companyId: supportedBody.companyId, domainIds: supportedBody.domainIds });
      setConflict(null);
      setAddingContact(false);
    }
  }, [supportedBody, reset]);

  if (!supportedBody) return null;

  const onSubmit = handleSubmit(async (values) => {
    setConflict(null);
    try {
      await updateSupportedBody({ id: supportedBody.id, input: values }).unwrap();
      onClose();
    } catch (err) {
      const body = (err as { data?: ApiErrorBody }).data;
      if (body?.error?.code === "CONFLICT") {
        const existing = body.error.details as { id: string; name: string } | undefined;
        setConflict(existing ? { message: body.error.message ?? "", existing } : { message: body.error.message ?? "" });
        return;
      }
      if (body?.error?.code === "VALIDATION_ERROR" && Array.isArray(body.error.details)) {
        for (const d of body.error.details) {
          setError(d.field as keyof EditFormValues, { message: d.message });
        }
        return;
      }
      // Generic/unexpected failure → toast (UX-DR16, EXPERIENCE.md "שמירה נכשלה"
      // row — applies to every form). Form values are untouched (no reset()
      // on this path), so the user can just retry.
      notifications.show({ color: "red", title: "שגיאה", message: "שמירה נכשלה — נסה/י שוב" });
    }
  });

  const handleDeactivate = async () => {
    try {
      await updateSupportedBody({ id: supportedBody.id, input: { isActive: false } }).unwrap();
      setConfirmingDeactivate(false);
      onClose();
    } catch {
      notifications.show({ color: "red", title: "שגיאה", message: "השבתה נכשלה — נסה/י שוב" });
    }
  };

  // Reactivating isn't destructive the way deactivating is (no AC called
  // for a confirm step here), so it applies directly — no Modal.
  const handleActivate = async () => {
    try {
      await updateSupportedBody({ id: supportedBody.id, input: { isActive: true } }).unwrap();
      onClose();
    } catch {
      notifications.show({ color: "red", title: "שגיאה", message: "הפעלה מחדש נכשלה — נסה/י שוב" });
    }
  };

  return (
    <>
      {/* Content Drawer direction (UX-DR7): opens from the left. */}
      <Drawer opened onClose={onClose} position="left" title="עריכת גוף נתמך">
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            {conflict && (
              <Alert color="red" title="שגיאה">
                {conflict.message}
                {conflict.existing && (
                  <>
                    {" "}
                    <Anchor href={`/supported-bodies/${conflict.existing.id}`}>
                      מעבר לרשומה הקיימת: {conflict.existing.name}
                    </Anchor>
                  </>
                )}
              </Alert>
            )}

            <TextInput label="שם" required {...register("name")} error={errors.name?.message} />

            <TextInput label='ח"פ' required {...register("companyId")} error={errors.companyId?.message} />

            <Controller
              name="domainIds"
              control={control}
              render={({ field }) => (
                <DomainMultiSelect
                  domains={domains}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={domainsLoading}
                  required
                  error={errors.domainIds?.message}
                />
              )}
            />

            <Button type="button" variant="default" onClick={() => setAddingContact(true)}>
              הוסף איש קשר
            </Button>

            <Group justify="space-between" mt="md">
              {supportedBody.isActive ? (
                <Button type="button" color="red" variant="subtle" onClick={() => setConfirmingDeactivate(true)}>
                  השבת
                </Button>
              ) : (
                <Button type="button" color="green" variant="subtle" onClick={handleActivate} loading={isSaving}>
                  הפעל מחדש
                </Button>
              )}
              <Button type="submit" disabled={!isValid} loading={isSaving}>
                שמירה
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>

      <Modal opened={confirmingDeactivate} onClose={() => setConfirmingDeactivate(false)} title="השבתת גוף נתמך">
        <Stack gap="md">
          <Text>
            להשבית את &quot;{supportedBody.name}&quot;? הגוף יוסתר מרשימות גופים פעילים, ואנשי קשר המשויכים אליו לא
            ישתנו.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmingDeactivate(false)}>
              ביטול
            </Button>
            <Button color="red" onClick={handleDeactivate} loading={isSaving}>
              השבת
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Drawer
        opened={addingContact}
        onClose={() => setAddingContact(false)}
        position="left"
        title="איש קשר חדש"
      >
        <ContactForm defaultSupportedBodyId={supportedBody.id} onSuccess={() => setAddingContact(false)} />
      </Drawer>
    </>
  );
}
