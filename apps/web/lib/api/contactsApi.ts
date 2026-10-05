import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  ContactDto,
  CreateContactInput,
  ListContactsQuery,
  ListContactsResult,
  UpdateContactInput,
  DeactivateContactInput,
} from "@contact-management/shared-schemas/contacts";

export const contactsApi = createApi({
  reducerPath: "contactsApi",
  baseQuery: fetchBaseQuery({ baseUrl: process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001" }),
  tagTypes: ["Contact"],
  endpoints: (builder) => ({
    listContacts: builder.query<ListContactsResult, Partial<ListContactsQuery>>({
      query: (params) => ({ url: "/contacts", params }),
      transformResponse: (response: { data: ContactDto[]; meta: { total: number; page: number; pageSize: number } }) => ({
        items: response.data,
        total: response.meta.total,
        page: response.meta.page,
        pageSize: response.meta.pageSize,
      }),
      providesTags: ["Contact"],
    }),
    createContact: builder.mutation<ContactDto, CreateContactInput>({
      query: (body) => ({ url: "/contacts", method: "POST", body }),
      transformResponse: (response: { data: ContactDto }) => response.data,
      invalidatesTags: ["Contact"],
    }),
    updateContact: builder.mutation<ContactDto, { id: string; input: UpdateContactInput }>({
      query: ({ id, input }) => ({ url: `/contacts/${id}`, method: "PATCH", body: input }),
      transformResponse: (response: { data: ContactDto }) => response.data,
      invalidatesTags: ["Contact"],
    }),
    addSupportedBody: builder.mutation<ContactDto, { id: string; supportedBodyId: string; domainIds: string[] }>({
      query: ({ id, supportedBodyId, domainIds }) => ({
        url: `/contacts/${id}/supported-bodies`,
        method: "POST",
        body: { supportedBodyId, domainIds },
      }),
      transformResponse: (response: { data: ContactDto }) => response.data,
      invalidatesTags: ["Contact"],
    }),
    updateSupportedBodyDomains: builder.mutation<
      ContactDto,
      { id: string; supportedBodyId: string; domainIds: string[] }
    >({
      query: ({ id, supportedBodyId, domainIds }) => ({
        url: `/contacts/${id}/supported-bodies/${supportedBodyId}`,
        method: "PATCH",
        body: { domainIds },
      }),
      transformResponse: (response: { data: ContactDto }) => response.data,
      invalidatesTags: ["Contact"],
    }),
    deactivateContact: builder.mutation<ContactDto, { id: string; input: DeactivateContactInput }>({
      query: ({ id, input }) => ({ url: `/contacts/${id}/deactivate`, method: "POST", body: input }),
      transformResponse: (response: { data: ContactDto }) => response.data,
      invalidatesTags: ["Contact"],
    }),
    activateContact: builder.mutation<ContactDto, { id: string }>({
      query: ({ id }) => ({ url: `/contacts/${id}/activate`, method: "POST" }),
      transformResponse: (response: { data: ContactDto }) => response.data,
      invalidatesTags: ["Contact"],
    }),
  }),
});

export const {
  useListContactsQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useAddSupportedBodyMutation,
  useUpdateSupportedBodyDomainsMutation,
  useDeactivateContactMutation,
  useActivateContactMutation,
} = contactsApi;
