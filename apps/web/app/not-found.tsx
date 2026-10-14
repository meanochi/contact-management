import Link from "next/link";
import { Button, Stack, Text, Title } from "@mantine/core";

// Replaces Next.js's default (English) 404 page.
export default function NotFound() {
  return (
    <Stack align="center" gap="sm" p="xl">
      <Title order={2}>הדף לא נמצא</Title>
      <Text c="dimmed">הכתובת שביקשת אינה קיימת או שהועברה למקום אחר.</Text>
      <Button component={Link} href="/">
        חזרה לדף הבית
      </Button>
    </Stack>
  );
}
