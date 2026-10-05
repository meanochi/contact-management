import { Stack, Title } from "@mantine/core";
import { NewSupportedBodyDrawer } from "@/components/supported-bodies/NewSupportedBodyDrawer";

// Story 1.2: just the create entry point. The actual list/search/filter
// table is Story 1.4 — this page gets a real list then, not before.
export default function SupportedBodiesPage() {
  return (
    <Stack gap="md">
      <Title order={2}>גופים נתמכים</Title>
      <NewSupportedBodyDrawer />
    </Stack>
  );
}
