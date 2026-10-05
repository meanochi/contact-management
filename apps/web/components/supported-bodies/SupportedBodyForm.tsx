"use client";

import { useForm, Controller } from "react-hook-form";
import { joiResolver } from "@hookform/resolvers/joi";
import { TextInput, Button, Stack, Alert, Anchor } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { createSupportedBodySchema } from "@contact-management/shared-schemas/supported-bodies";
import type { CreateSupportedBodyInput } from "@contact-management/shared-schemas/supported-bodies";
import { DomainMultiSelect } from "@contact-management/ui";
import { useListActiveDomainsQuery } from "@/lib/api/domainsApi";
import { useCreateSupportedBodyMutation } from "@/lib/api/supportedBodiesApi";
import { useState } from "react";

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: { field: string; message: string }[] | { id: string; name: string } | null;
  };
}

export function SupportedBodyForm({ onSuccess }: { onSuccess?: () => void }) {
  const { data: domains = [], isLoading: domainsLoading } = useListActiveDomainsQuery();
  const [createSupportedBody, { isLoading: isSaving }] = useCreateSupportedBodyMutation();
  const [conflict, setConflict] = useState<{ message: string; existing?: { id: string; name: string } } | null>(
    null,
  );

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isValid },
  } = useForm<CreateSupportedBodyInput>({
    resolver: joiResolver(createSupportedBodySchema),
    mode: "onChange", // real-time validation, not just on submit — UX-DR12
    defaultValues: { name: "", companyId: "", domainIds: [] },
  });

  const onSubmit = handleSubmit(async (values) => {
    setConflict(null);
    try {
      await createSupportedBody(values).unwrap();
      onSuccess?.();
    } catch (err) {
      const body = (err as { data?: ApiErrorBody }).data;
      if (body?.error?.code === "CONFLICT") {
        const existing = body.error.details as { id: string; name: string } | undefined;
        setConflict(existing ? { message: body.error.message ?? "", existing } : { message: body.error.message ?? "" });
        return;
      }
      if (body?.error?.code === "VALIDATION_ERROR" && Array.isArray(body.error.details)) {
        for (const d of body.error.details) {
          setError(d.field as keyof CreateSupportedBodyInput, { message: d.message });
        }
        return;
      }
      // Generic/unexpected failure → toast (UX-DR16, EXPERIENCE.md "שמירה נכשלה"
      // row — applies to every form). Form values are untouched (no reset()
      // on this path), so the user can just retry.
      notifications.show({ color: "red", title: "שגיאה", message: "שמירה נכשלה — נסה/י שוב" });
    }
  });

  return (
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

        <Button type="submit" disabled={!isValid} loading={isSaving}>
          שמירה
        </Button>
      </Stack>
    </form>
  );
}
