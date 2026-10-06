"use client";

import { useState } from "react";
import { TextInput, Checkbox, Select, Table, Skeleton, Pagination, Badge, Button, Group } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { EmptyState } from "@contact-management/ui";
import { useListContactsQuery } from "@/lib/api/contactsApi";
import { useListSupportedBodiesQuery } from "@/lib/api/supportedBodiesApi";
import { useListActiveDomainsQuery } from "@/lib/api/domainsApi";
import type { ContactDto } from "@contact-management/shared-schemas/contacts";

const PAGE_SIZE = 20;

// Up to 5 years back plus the current one — a plain dropdown, not a date
// range picker; nothing in the AC asks for more than "year" granularity.
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR - i));

// Story 1.8 — search/filter toolbar added on top of the Story 1.5 list.
// Client Component — kept consistent with SupportedBodiesList's own
// deliberate simplification (Story 1.4) rather than switching this one
// screen to the canonical Server-Component + URL-searchParams pattern;
// neither source requirement doc calls for URL-shareable filters either way.
export function ContactsList({
  onCreateNew,
  onRowClick,
}: {
  onCreateNew: () => void;
  onRowClick: (contact: ContactDto) => void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300); // UX-DR22
  const [includeInactive, setIncludeInactive] = useState(false);
  const [supportedBodyId, setSupportedBodyId] = useState<string | null>(null);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [updatedYear, setUpdatedYear] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: supportedBodiesPage } = useListSupportedBodiesQuery({ page: 1, pageSize: 100 });
  const supportedBodies = supportedBodiesPage?.items ?? [];
  const supportedBodyNameById = new Map(supportedBodies.map((b) => [b.id, b.name]));
  const { data: domains = [] } = useListActiveDomainsQuery();

  const { data, isLoading } = useListContactsQuery({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(includeInactive ? { includeInactive: true } : {}),
    ...(supportedBodyId ? { supportedBodyId } : {}),
    ...(domainId ? { domainId } : {}),
    ...(updatedYear ? { updatedYear: Number(updatedYear) } : {}),
    page,
    pageSize: PAGE_SIZE,
  });

  const resetToFirstPage = () => setPage(1);

  const hasActiveFilters = Boolean(debouncedSearch || includeInactive || supportedBodyId || domainId || updatedYear);

  return (
    <>
      <Group mb="md" align="flex-end">
        <TextInput
          placeholder="חיפוש לפי שם"
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            resetToFirstPage();
          }}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="גוף נתמך"
          clearable
          data={supportedBodies.map((b) => ({ value: b.id, label: b.name }))}
          value={supportedBodyId}
          onChange={(value) => {
            setSupportedBodyId(value);
            resetToFirstPage();
          }}
        />
        <Select
          placeholder="תחום"
          clearable
          data={domains.map((d) => ({ value: d.id, label: d.name }))}
          value={domainId}
          onChange={(value) => {
            setDomainId(value);
            resetToFirstPage();
          }}
        />
        <Select
          placeholder="שנת עדכון אחרונה"
          clearable
          data={YEAR_OPTIONS}
          value={updatedYear}
          onChange={(value) => {
            setUpdatedYear(value);
            resetToFirstPage();
          }}
        />
        <Checkbox
          label="כלול לא פעילים"
          checked={includeInactive}
          onChange={(e) => {
            setIncludeInactive(e.currentTarget.checked);
            resetToFirstPage();
          }}
        />
      </Group>

      {isLoading ? (
        // UX-DR15 — row-shaped Skeleton, not a generic spinner.
        <Table>
          <Table.Tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <Table.Tr key={i}>
                <Table.Td>
                  <Skeleton height={20} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : data && data.items.length > 0 ? (
        <>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>שם</Table.Th>
                <Table.Th>תפקיד</Table.Th>
                <Table.Th>טלפון</Table.Th>
                <Table.Th>דוא&quot;ל</Table.Th>
                <Table.Th>גוף נתמך</Table.Th>
                <Table.Th>ערוצי תקשורת</Table.Th>
                <Table.Th>סטטוס</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.items.map((contact) => (
                // UX-DR11 — clicking anywhere on the row opens the edit
                // Drawer; there is no "..." menu to hide it behind.
                <Table.Tr key={contact.id} onClick={() => onRowClick(contact)} style={{ cursor: "pointer" }}>
                  <Table.Td>
                    {contact.firstName} {contact.lastName}
                  </Table.Td>
                  <Table.Td>{contact.role ?? ""}</Table.Td>
                  <Table.Td>{contact.phone ?? ""}</Table.Td>
                  <Table.Td>{contact.emails.join(", ")}</Table.Td>
                  <Table.Td>
                    {contact.supportedBodyLinks
                      .map((link) => supportedBodyNameById.get(link.supportedBodyId) ?? link.supportedBodyId)
                      .join(", ")}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {contact.emailOptIn && (
                        <Badge variant="light" color="blue">
                          דוא&quot;ל
                        </Badge>
                      )}
                      {contact.smsOptIn && (
                        <Badge variant="light" color="violet">
                          SMS
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={contact.status === "ACTIVE" ? "green" : "gray"}>
                      {contact.status === "ACTIVE" ? "פעיל" : "לא פעיל"}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {data.total > PAGE_SIZE && (
            // UX-DR24 — Pagination, never infinite scroll.
            <Pagination mt="md" total={Math.ceil(data.total / PAGE_SIZE)} value={page} onChange={setPage} />
          )}
        </>
      ) : (
        <EmptyState
          icon="👤"
          title={hasActiveFilters ? "אין תוצאות תואמות" : "אין עדיין אנשי קשר"}
          description={hasActiveFilters ? "נסה/י לשנות את הסינון" : "התחילו ביצירת איש הקשר הראשון"}
          action={!hasActiveFilters ? <Button onClick={onCreateNew}>איש קשר ראשון</Button> : undefined}
        />
      )}
    </>
  );
}
