"use client";

import { useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import { TextInput, Textarea, Checkbox, Button, Stack, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { createContactSchema } from "@contact-management/shared-schemas/contacts";
import type { CreateContactInput } from "@contact-management/shared-schemas/contacts";
import { SupportedBodySelect, SupportedBodyDomainsPicker } from "@contact-management/ui";
import { useListSupportedBodiesQuery } from "@/lib/api/supportedBodiesApi";
import { useListActiveDomainsQuery } from "@/lib/api/domainsApi";
import { useCreateContactMutation } from "@/lib/api/contactsApi";

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: { field: string; message: string }[] | null;
  };
}

// Story 1.5. defaultSupportedBodyId pre-fills the field (still changeable)
// when the form is opened from a specific SupportedBody's edit Drawer — the
// AC's "פותח טופס... מתוך מסך גוף נתמך (משויך אוטומטית)" case.
export function ContactForm({
  defaultSupportedBodyId,
  onSuccess,
}: {
  defaultSupportedBodyId?: string;
  onSuccess?: () => void;
}) {
  // pageSize at the schema's max (100) — a plain "get everything active" read
  // for a Select's options list, not real pagination (no UI for paging this).
  const { data: supportedBodiesPage, isLoading: supportedBodiesLoading } = useListSupportedBodiesQuery({
    isActive: true,
    page: 1,
    pageSize: 100,
  });
  const supportedBodies = supportedBodiesPage?.items ?? [];
  const { data: domains = [] } = useListActiveDomainsQuery();
  const [createContact, { isLoading: isSaving }] = useCreateContactMutation();

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isValid },
  } = useForm<CreateContactInput>({
    resolver: joiResolver(createContactSchema),
    mode: "onChange", // real-time validation, not just on submit — UX-DR12
    defaultValues: {
      firstName: "",
      lastName: "",
      idNumber: "",
      role: "",
      phone: "",
      emails: [""],
      notes: "",
      emailOptIn: false,
      smsOptIn: false,
      supportedBodyId: defaultSupportedBodyId ?? "",
      domainIds: [],
    },
  });

  const supportedBodyId = useWatch({ control, name: "supportedBodyId" });
  const selectedBody = supportedBodies.find((b) => b.id === supportedBodyId);
  // Only this body's own domains — never any domain unrelated to it (AD-11:
  // packages/ui stays presentational, this narrowing happens here).
  const selectedBodyDomains = domains.filter((d) => selectedBody?.domainIds.includes(d.id) ?? false);

  // Post-1.6 revision: picking/changing the body resets domainIds to *all*
  // of its domains (the picker's default), not a leftover subset from a
  // previously selected body. Depending on the joined id string (not the
  // array/object references, which change on every supportedBodies refetch)
  // is what keeps this from re-running on unrelated data refreshes.
  const selectedBodyDomainIdsKey = selectedBody?.domainIds.join(",") ?? "";
  useEffect(() => {
    setValue("domainIds", selectedBodyDomainIdsKey ? selectedBodyDomainIdsKey.split(",") : [], {
      shouldValidate: true,
    });
  }, [selectedBodyDomainIdsKey, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createContact(values).unwrap();
      onSuccess?.();
    } catch (err) {
      const body = (err as { data?: ApiErrorBody }).data;
      if (body?.error?.code === "VALIDATION_ERROR" && Array.isArray(body.error.details)) {
        for (const d of body.error.details) {
          // Joi reports array-item errors as "emails.0" — there's no such
          // RHF field, so collapse any emails.* path onto the array field itself.
          const field = d.field.startsWith("emails") ? "emails" : d.field;
          setError(field as keyof CreateContactInput, { message: d.message });
        }
        return;
      }
      // Generic/unexpected failure → toast (UX-DR16, EXPERIENCE.md "שמירה נכשלה"
      // row — applies to every form). Form values are untouched (no reset()
      // on this path), so the user can just retry.
      notifications.show({ color: "red", title: "שגיאה", message: "שמירה נכשלה — נסה/י שוב" });
    }
  });

  const emailsError = typeof errors.emails?.message === "string" ? errors.emails.message : undefined;

  return (
    <form onSubmit={onSubmit}>
      <Stack gap="md">
        <Group grow>
          <TextInput label="שם פרטי" required {...register("firstName")} error={errors.firstName?.message} />
          <TextInput label="שם משפחה" required {...register("lastName")} error={errors.lastName?.message} />
        </Group>

        <TextInput label='ת"ז' {...register("idNumber")} error={errors.idNumber?.message} />
        <TextInput label="תפקיד" {...register("role")} error={errors.role?.message} />
        <TextInput label="טלפון" {...register("phone")} error={errors.phone?.message} />

        <Controller
          name="supportedBodyId"
          control={control}
          render={({ field }) => (
            <SupportedBodySelect
              supportedBodies={supportedBodies}
              value={field.value || null}
              onChange={(id) => field.onChange(id ?? "")}
              disabled={supportedBodiesLoading}
              required
              error={errors.supportedBodyId?.message}
            />
          )}
        />

        {supportedBodyId && (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              תחומים (מתוך תחומי הגוף שנבחר)
            </Text>
            <Controller
              name="domainIds"
              control={control}
              render={({ field }) => (
                <SupportedBodyDomainsPicker domains={selectedBodyDomains} value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.domainIds && (
              <Text c="red" size="sm">
                {errors.domainIds.message}
              </Text>
            )}
          </Stack>
        )}

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
                    required={index === 0}
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

        <Checkbox label="מעוניין בהודעות דוא&quot;ל" {...register("emailOptIn")} />
        <Checkbox label="מעוניין בהודעות SMS" {...register("smsOptIn")} />

        <Textarea label="הערות" {...register("notes")} error={errors.notes?.message} />

        <Button type="submit" disabled={!isValid} loading={isSaving}>
          שמירה
        </Button>
      </Stack>
    </form>
  );
}
