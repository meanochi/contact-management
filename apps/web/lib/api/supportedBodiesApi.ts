import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  CreateSupportedBodyInput,
  ListSupportedBodiesQuery,
  ListSupportedBodiesResult,
  SupportedBodyDto,
  UpdateSupportedBodyInput,
} from "@contact-management/shared-schemas/supported-bodies";

export const supportedBodiesApi = createApi({
  reducerPath: "supportedBodiesApi",
  baseQuery: fetchBaseQuery({ baseUrl: process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001" }),
  tagTypes: ["SupportedBody"],
  endpoints: (builder) => ({
    listSupportedBodies: builder.query<ListSupportedBodiesResult, Partial<ListSupportedBodiesQuery>>({
      query: (params) => ({ url: "/supported-bodies", params }),
      transformResponse: (response: { data: SupportedBodyDto[]; meta: { total: number; page: number; pageSize: number } }) => ({
        items: response.data,
        total: response.meta.total,
        page: response.meta.page,
        pageSize: response.meta.pageSize,
      }),
      providesTags: ["SupportedBody"],
    }),
    createSupportedBody: builder.mutation<SupportedBodyDto, CreateSupportedBodyInput>({
      query: (body) => ({ url: "/supported-bodies", method: "POST", body }),
      transformResponse: (response: { data: SupportedBodyDto }) => response.data,
      invalidatesTags: ["SupportedBody"],
    }),
    updateSupportedBody: builder.mutation<SupportedBodyDto, { id: string; input: UpdateSupportedBodyInput }>({
      query: ({ id, input }) => ({ url: `/supported-bodies/${id}`, method: "PATCH", body: input }),
      transformResponse: (response: { data: SupportedBodyDto }) => response.data,
      invalidatesTags: ["SupportedBody"],
    }),
  }),
});

export const { useListSupportedBodiesQuery, useCreateSupportedBodyMutation, useUpdateSupportedBodyMutation } =
  supportedBodiesApi;
