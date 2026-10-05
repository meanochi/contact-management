import { Stack, Title } from "@mantine/core";
import { ContactsScreen } from "@/components/contacts/ContactsScreen";

export default function ContactsPage() {
  return (
    <Stack gap="md">
      <Title order={2}>אנשי קשר</Title>
      <ContactsScreen />
    </Stack>
  );
}
