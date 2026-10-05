import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { DomainDto } from "@contact-management/shared-schemas/domains";

// RTK Query owns all server-sourced data (expertise-react-nextjs §5) —
// baseUrl points at apps/api, never apps/web itself (AD-12).
export const domainsApi = createApi({
  reducerPath: "domainsApi",
  baseQuery: fetchBaseQuery({ baseUrl: process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001" }),
  tagTypes: ["Domain"],
  endpoints: (builder) => ({
    listActiveDomains: builder.query<DomainDto[], void>({
      query: () => "/domains",
      transformResponse: (response: { data: DomainDto[] }) => response.data,
      providesTags: ["Domain"],
    }),
  }),
});

export const { useListActiveDomainsQuery } = domainsApi;
