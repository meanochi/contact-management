"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import { TextInput, Textarea, Checkbox, Button, Stack, Group, Text, Drawer, Modal } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { updateContactSchema } from "@contact-management/shared-schemas/contacts";
import type { ContactDto } from "@contact-management/shared-schemas/contacts";
import { SupportedBodySelect, SupportedBodyDomainsPicker, type DomainOption } from "@contact-management/ui";
import { useListSupportedBodiesQuery } from "@/lib/api/supportedBodiesApi";
import { useListActiveDomainsQuery } from "@/lib/api/domainsApi";
import {
  useUpdateContactMutation,
  useAddSupportedBodyMutation,
  useUpdateSupportedBodyDomainsMutation,
  useRemoveSupportedBodyMutation,
  useActivateContactMutation,
} from "@/lib/api/contactsApi";
import { MarkInactiveModal } from "./MarkInactiveModal";

// An existing link's domain subset was only ever choosable once, at
// creation/add time — this fills that gap. Local pending state + a "save"
// button that only appears once something actually changed — not an
// auto-save-per-toggle, consistent with the rest of the Drawer's
// explicit-save pattern.
function LinkedBodyBlock({
  index,
  bodyName,
  domainIds,
  bodyDomains,
  onSave,
  isSaving,
  onRemove,
}: {
  index: number;
  bodyName: string;
  domainIds: string[];
  bodyDomains: DomainOption[];
  onSave: (domainIds: string[]) => void;
  isSaving: boolean;
  onRemove: () => void;
}) {
  const [pending, setPending] = useState<string[]>(domainIds);
  const domainIdsKey = domainIds.join(",");

  useEffect(() => {
    setPending(domainIdsKey ? domainIdsKey.split(",") : []);
  }, [domainIdsKey]);

  const isDirty = pending.length !== domainIds.length || pending.some((id) => !domainIds.includes(id));

  return (
    <Stack gap={4}>
      <Group justify="space-between" gap="xs">
        <Text size="sm" fw={500}>
          שיוך {index + 1} — {bodyName}
        </Text>
        <Button type="button" size="xs" variant="subtle" color="red" onClick={onRemove}>
          הסר שיוך
        </Button>
      </Group>
      <SupportedBodyDomainsPicker domains={bodyDomains} value={pending} onChange={setPending} />
      {isDirty && (
        <Button
          type="button"
          size="xs"
          variant="light"
          disabled={pending.length === 0}
          loading={isSaving}
          onClick={() => onSave(pending)}
        >
          שמירת שינויים בתחומים
        </Button>
      )}
    </Stack>
  );
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: { field: string; message: string }[] | null;
  };
}

// role/phone/emails/notes/channel prefs only — firstName/lastName/idNumber
// are not editable in this story (per the AC's field list), and
// supportedBodyId is handled by the separate "link" section below.
interface EditFormValues {
  role: string;
  phone: string;
  emails: string[];
  notes: string;
  emailOptIn: boolean;
  smsOptIn: boolean;
}

export function ContactEditDrawer({ contact, onClose }: { contact: ContactDto | null; onClose: () => void }) {
  // Bug found by Rachel: fetching isActive-only here meant an *existing*
  // link to a body that was later deactivated couldn't resolve a name at
  // all (the fallback showed the raw id). Fetch every body regardless of
  // status — "add another" below filters down to active-only itself, since
  // that's the only place a *new* link should be restricted to active bodies.
  const { data: supportedBodiesPage } = useListSupportedBodiesQuery({ page: 1, pageSize: 100 });
  const supportedBodies = supportedBodiesPage?.items ?? [];
  const { data: domains = [] } = useListActiveDomainsQuery();
  const [updateContact, { isLoading: isSaving }] = useUpdateContactMutation();
  const [addSupportedBody, { isLoading: isLinking }] = useAddSupportedBodyMutation();
  const [updateSupportedBodyDomains, { isLoading: isSavingDomains }] = useUpdateSupportedBodyDomainsMutation();
  const [removeSupportedBody, { isLoading: isRemovingBody }] = useRemoveSupportedBodyMutation();
  const [activateContact, { isLoading: isActivating }] = useActivateContactMutation();
  const [addingBodyId, setAddingBodyId] = useState<string | null>(null);
  const [addingDomainIds, setAddingDomainIds] = useState<string[]>([]);
  const [markingInactive, setMarkingInactive] = useState(false);
  // The missing counterpart to "שייך" — removing a link is more
  // consequential than toggling a domain pill, so it gets the same
  // confirm-Modal pattern as SupportedBody's own deactivate flow.
  const [confirmingRemoveBodyId, setConfirmingRemoveBodyId] = useState<string | null>(null);
  // `contact` is a one-time snapshot passed down from the row that was
  // clicked (ContactsScreen's `editing` state) — it never gets live updates.
  // Every other mutation here closes the Drawer on success, so staleness
  // never shows; "שייך" (add body) is the one action that keeps it open, so
  // its result overrides what's displayed instead of relying on the stale prop.
  const [linkedOverride, setLinkedOverride] = useState<ContactDto["supportedBodyLinks"] | null>(null);

  const addingBody = supportedBodies.find((b) => b.id === addingBodyId);
  // Only the chosen body's own domains — AD-11, narrowed here, not in packages/ui.
  const addingBodyDomains = domains.filter((d) => addingBody?.domainIds.includes(d.id) ?? false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isValid },
  } = useForm<EditFormValues>({
    resolver: joiResolver(updateContactSchema),
    mode: "onChange", // real-time validation, not just on submit — UX-DR12
    defaultValues: { role: "", phone: "", emails: [""], notes: "", emailOptIn: false, smsOptIn: false },
  });

  // One Drawer instance is reused across every row, so the form has to be
  // re-seeded whenever a different contact opens — it can't rely on mount.
  useEffect(() => {
    if (contact) {
      reset({
        role: contact.role ?? "",
        phone: contact.phone ?? "",
        emails: contact.emails,
        notes: contact.notes ?? "",
        emailOptIn: contact.emailOptIn,
        smsOptIn: contact.smsOptIn,
      });
      setAddingBodyId(null);
      setAddingDomainIds([]);
      setMarkingInactive(false);
      setLinkedOverride(null);
      setConfirmingRemoveBodyId(null);
    }
  }, [contact, reset]);

  if (!contact) return null;

  const supportedBodyLinks = linkedOverride ?? contact.supportedBodyLinks;
  const linkedBodyIds = supportedBodyLinks.map((link) => link.supportedBodyId);
  // Already-linked bodies don't appear as options — re-adding one is a
  // conflict, not a useful action (the Select just hides the no-op). Also
  // excludes inactive bodies — `supportedBodies` now includes them (see
  // above), but a *new* link should never be made to a deactivated body.
  const availableBodies = supportedBodies.filter((b) => !linkedBodyIds.includes(b.id) && b.isActive);

  // Picking a body for the "add another" section auto-fills all of its
  // domains (same default as ContactForm) — reset whenever the choice changes.
  const handleAddingBodyChange = (id: string | null) => {
    setAddingBodyId(id);
    const body = supportedBodies.find((b) => b.id === id);
    setAddingDomainIds(body?.domainIds ?? []);
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateContact({ id: contact.id, input: values }).unwrap();
      onClose();
    } catch (err) {
      const body = (err as { data?: ApiErrorBody }).data;
      if (body?.error?.code === "VALIDATION_ERROR" && Array.isArray(body.error.details)) {
        for (const d of body.error.details) {
          // Joi reports array-item errors as "emails.0" — there's no such
          // RHF field, so collapse any emails.* path onto the array field itself.
          const field = d.field.startsWith("emails") ? "emails" : d.field;
          setError(field as keyof EditFormValues, { message: d.message });
        }
        return;
      }
      // Generic/unexpected failure → toast (UX-DR16); form values untouched
      // (no reset() on this path), so the user can just retry.
      notifications.show({ color: "red", title: "שגיאה", message: "שמירה נכשלה — נסה/י שוב" });
    }
  });

  const handleAddSupportedBody = async () => {
    if (!addingBodyId || addingDomainIds.length === 0) return;
    try {
      const result = await addSupportedBody({
        id: contact.id,
        supportedBodyId: addingBodyId,
        domainIds: addingDomainIds,
      }).unwrap();
      setLinkedOverride(result.supportedBodyLinks);
      setAddingBodyId(null);
      setAddingDomainIds([]);
    } catch (err) {
      const body = (err as { data?: ApiErrorBody }).data;
      notifications.show({ color: "red", title: "שגיאה", message: body?.error?.message ?? "שיוך נכשל — נסה/י שוב" });
    }
  };

  const handleSaveLinkDomains = async (supportedBodyId: string, domainIds: string[]) => {
    try {
      const result = await updateSupportedBodyDomains({ id: contact.id, supportedBodyId, domainIds }).unwrap();
      setLinkedOverride(result.supportedBodyLinks);
    } catch (err) {
      const body = (err as { data?: ApiErrorBody }).data;
      notifications.show({ color: "red", title: "שגיאה", message: body?.error?.message ?? "עדכון תחומים נכשל — נסה/י שוב" });
    }
  };

  const handleRemoveSupportedBody = async () => {
    if (!confirmingRemoveBodyId) return;
    try {
      const result = await removeSupportedBody({ id: contact.id, supportedBodyId: confirmingRemoveBodyId }).unwrap();
      setLinkedOverride(result.supportedBodyLinks);
      setConfirmingRemoveBodyId(null);
    } catch (err) {
      const body = (err as { data?: ApiErrorBody }).data;
      // The Service rejects removing a Contact's *last* remaining link
      // (CONFLICT) — surfaced here with its own Hebrew message, not a
      // generic fallback.
      notifications.show({ color: "red", title: "שגיאה", message: body?.error?.message ?? "הסרת השיוך נכשלה — נסה/י שוב" });
    }
  };

  // Reactivation — not from a story AC, mirrors SupportedBody's own
  // "הפעל מחדש". No confirm Modal — non-destructive.
  const handleActivate = async () => {
    try {
      await activateContact({ id: contact.id }).unwrap();
      onClose();
    } catch {
      notifications.show({ color: "red", title: "שגיאה", message: "הפעלה מחדש נכשלה — נסה/י שוב" });
    }
  };

  const emailsError = typeof errors.emails?.message === "string" ? errors.emails.message : undefined;

  return (
    // Content Drawer direction (UX-DR7): opens from the left.
    <Drawer opened onClose={onClose} position="left" title="עריכת איש קשר">
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <Text fw={600}>
            {contact.firstName} {contact.lastName}
          </Text>

          <TextInput label="תפקיד" required {...register("role")} error={errors.role?.message} />
          <TextInput label="טלפון" required {...register("phone")} error={errors.phone?.message} />

          <Controller
            name="emails"
            control={control}
            render={({ field }) => (
              <Stack gap="xs">
                {field.value.map((email, index) => (
                  <Group key={index} align="flex-end" gap="xs">
                    <TextInput
                      style={{ flex: 1 }}
                      label={index === 0 ? 'דוא"ל' : undefined}
                      value={email}
                      onChange={(e) => {
                        const next = [...field.value];
                        next[index] = e.currentTarget.value;
                        field.onChange(next);
                      }}
                    />
                    {field.value.length > 1 && (
                      <Button
                        type="button"
                        variant="subtle"
                        color="red"
                        onClick={() => field.onChange(field.value.filter((_, i) => i !== index))}
                      >
                        הסר
                      </Button>
                    )}
                  </Group>
                ))}
                <Button type="button" variant="subtle" onClick={() => field.onChange([...field.value, ""])}>
                  הוסף כתובת נוספת
                </Button>
                {emailsError && (
                  <Text c="red" size="sm">
                    {emailsError}
                  </Text>
                )}
              </Stack>
            )}
          />

          <Checkbox label='מעוניין בהודעות דוא"ל' {...register("emailOptIn")} />
          <Checkbox label="מעוניין בהודעות SMS" {...register("smsOptIn")} />

          <Textarea label="הערות" {...register("notes")} error={errors.notes?.message} />

          <Group justify="space-between" mt="md">
            {contact.status === "ACTIVE" ? (
              <Button type="button" color="red" variant="subtle" onClick={() => setMarkingInactive(true)}>
                סמן כלא פעיל
              </Button>
            ) : (
              <Button type="button" color="green" variant="subtle" onClick={handleActivate} loading={isActivating}>
                הפעל מחדש
              </Button>
            )}
            <Button type="submit" disabled={!isValid} loading={isSaving}>
              שמירה
            </Button>
          </Group>

          <Stack gap="xs" mt="md">
            <Text fw={600}>גופים נתמכים משויכים</Text>
            {/* Each link shown with its own editable domain subset — not just
                the body's full domain list (post-1.6 revision). */}
            {supportedBodyLinks.map((link, index) => {
              const linkBody = supportedBodies.find((b) => b.id === link.supportedBodyId);
              const linkBodyDomains = domains.filter((d) => linkBody?.domainIds.includes(d.id) ?? false);
              // A link to a body that's since been deactivated must still
              // show its real name, not the raw id — plus a clear
              // "(גוף מושבת)" indicator instead of silently looking
              // identical to an active link.
              const bodyName = linkBody
                ? linkBody.isActive
                  ? linkBody.name
                  : `${linkBody.name} (גוף מושבת)`
                : "גוף נתמך לא נמצא";
              return (
                <LinkedBodyBlock
                  key={link.supportedBodyId}
                  index={index}
                  bodyName={bodyName}
                  domainIds={link.domainIds}
                  bodyDomains={linkBodyDomains}
                  onSave={(domainIds) => handleSaveLinkDomains(link.supportedBodyId, domainIds)}
                  isSaving={isSavingDomains}
                  onRemove={() => setConfirmingRemoveBodyId(link.supportedBodyId)}
                />
              );
            })}

            <Text size="sm" fw={500} mt="xs">
              שייך לגוף נתמך נוסף
            </Text>
            <SupportedBodySelect supportedBodies={availableBodies} value={addingBodyId} onChange={handleAddingBodyChange} />
            {addingBodyId && (
              <SupportedBodyDomainsPicker domains={addingBodyDomains} value={addingDomainIds} onChange={setAddingDomainIds} />
            )}
            <Button
              type="button"
              variant="default"
              disabled={!addingBodyId || addingDomainIds.length === 0}
              loading={isLinking}
              onClick={handleAddSupportedBody}
            >
              שייך
            </Button>
          </Stack>
        </Stack>
      </form>

      <MarkInactiveModal
        opened={markingInactive}
        contactId={contact.id}
        onClose={() => setMarkingInactive(false)}
        onDeactivated={() => {
          setMarkingInactive(false);
          onClose();
        }}
      />

      <Modal
        opened={confirmingRemoveBodyId !== null}
        onClose={() => setConfirmingRemoveBodyId(null)}
        title="הסרת שיוך לגוף נתמך"
      >
        <Stack gap="md">
          <Text>
            להסיר את השיוך ל&quot;
            {supportedBodies.find((b) => b.id === confirmingRemoveBodyId)?.name ?? confirmingRemoveBodyId}
            &quot;? התחומים שנבחרו עבור השיוך הזה יימחקו גם הם.
          </Text>
          <Group justify="flex-end">
            <Button type="button" variant="default" onClick={() => setConfirmingRemoveBodyId(null)}>
              ביטול
            </Button>
            <Button type="button" color="red" loading={isRemovingBody} onClick={handleRemoveSupportedBody}>
              הסר שיוך
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Drawer>
  );
}
