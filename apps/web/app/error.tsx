"use client";

import { useEffect } from "react";
import { Button, Stack, Text, Title } from "@mantine/core";

// Replaces Next.js's default (English) error page: an unexpected crash while
// rendering a screen must still speak Hebrew to the user. Must be a Client
// Component — error boundaries are client-only.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest lets support match this to the server-side log of the failure.
    console.error("Unhandled render error", error.digest ?? "");
  }, [error]);

  return (
    <Stack align="center" gap="sm" p="xl">
      <Title order={2}>משהו השתבש</Title>
      <Text c="dimmed">אירעה שגיאה בלתי צפויה. אפשר לנסות שוב, ואם הבעיה חוזרת — לפנות לתמיכה.</Text>
      <Button onClick={reset}>נסו שוב</Button>
    </Stack>
  );
}
