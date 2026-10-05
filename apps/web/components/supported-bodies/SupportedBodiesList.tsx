"use client";

import { useState } from "react";
import { TextInput, Select, Table, Skeleton, Pagination, Group, Badge, Button } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { EmptyState } from "@contact-management/ui";
import { useListSupportedBodiesQuery } from "@/lib/api/supportedBodiesApi";
import { useListActiveDomainsQuery } from "@/lib/api/domainsApi";
import type { SupportedBodyDto } from "@contact-management/shared-schemas/supported-bodies";

const PAGE_SIZE = 20;

// Client Component, not the Server-Component-+-hydration pattern
// expertise-react-nextjs describes as canonical — a deliberate simplification
// for this first list screen: the AC only requires a Skeleton during loading
// (not an SSR-populated first paint), which a pure client fetch satisfies
// directly. Revisit if a later story needs the SSR version.
export function SupportedBodiesList({
  onCreateNew,
  onRowClick,
}: {
  onCreateNew: () => void;
  onRowClick: (body: SupportedBodyDto) => void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300); // UX-DR22
  const [domainId, setDomainId] = useState<string | null>(null);
  // Mantine Select needs string values — "" means "הכל" (no status filter),
  // converted to a real boolean (or omitted) only when building the query.
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: domains = [] } = useListActiveDomainsQuery();
  const { data, isLoading } = useListSupportedBodiesQuery({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(domainId ? { domainId } : {}),
    ...(statusFilter ? { isActive: statusFilter === "active" } : {}),
    page,
    pageSize: PAGE_SIZE,
  });

  const domainNameById = new Map(domains.map((d) => [d.id, d.name]));
  const hasActiveFilters = Boolean(debouncedSearch || domainId || statusFilter);

  return (
    <>
      <Group mb="md" align="flex-end">
        <TextInput
          placeholder="חיפוש לפי שם או ח&quot;פ"
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="תחום"
          clearable
          data={domains.map((d) => ({ value: d.id, label: d.name }))}
          value={domainId}
          onChange={(value) => {
            setDomainId(value);
            setPage(1);
          }}
        />
        <Select
          placeholder="סטטוס"
          clearable
          data={[
            { value: "active", label: "פעיל" },
            { value: "inactive", label: "לא פעיל" },
          ]}
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
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
                <Table.Th>ח"פ</Table.Th>
                <Table.Th>תחומים</Table.Th>
                <Table.Th>סטטוס</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.items.map((body) => (
                // UX-DR11 — clicking anywhere on the row opens the edit
                // Drawer; there is no "..." menu to hide it behind.
                <Table.Tr
                  key={body.id}
                  onClick={() => onRowClick(body)}
                  style={{ cursor: "pointer" }}
                >
                  <Table.Td>{body.name}</Table.Td>
                  <Table.Td>{body.companyId}</Table.Td>
                  <Table.Td>
                    {body.domainIds.map((id) => domainNameById.get(id) ?? id).join(", ")}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={body.isActive ? "green" : "gray"}>
                      {body.isActive ? "פעיל" : "לא פעיל"}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {data.total > PAGE_SIZE && (
            // UX-DR24 — Pagination, never infinite scroll.
            <Pagination
              mt="md"
              total={Math.ceil(data.total / PAGE_SIZE)}
              value={page}
              onChange={setPage}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon="🏢"
          title={hasActiveFilters ? "אין תוצאות תואמות" : "אין עדיין גופים נתמכים"}
          description={hasActiveFilters ? "נסה/י לשנות את הסינון" : "התחילו ביצירת הגוף הנתמך הראשון"}
          action={!hasActiveFilters ? <Button onClick={onCreateNew}>גוף נתמך חדש</Button> : undefined}
        />
      )}
    </>
  );
}
