import { Stack, Title } from "@mantine/core";
import { SupportedBodiesScreen } from "@/components/supported-bodies/SupportedBodiesScreen";

export default function SupportedBodiesPage() {
  return (
    <Stack gap="md">
      <Title order={2}>גופים נתמכים</Title>
      <SupportedBodiesScreen />
    </Stack>
  );
}
