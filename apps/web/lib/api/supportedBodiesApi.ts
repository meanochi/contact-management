import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  CreateSupportedBodyInput,
  SupportedBodyDto,
} from "@contact-management/shared-schemas/supported-bodies";

export const supportedBodiesApi = createApi({
  reducerPath: "supportedBodiesApi",
  baseQuery: fetchBaseQuery({ baseUrl: process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001" }),
  tagTypes: ["SupportedBody"],
  endpoints: (builder) => ({
    createSupportedBody: builder.mutation<SupportedBodyDto, CreateSupportedBodyInput>({
      query: (body) => ({ url: "/supported-bodies", method: "POST", body }),
      transformResponse: (response: { data: SupportedBodyDto }) => response.data,
      invalidatesTags: ["SupportedBody"],
    }),
  }),
});

export const { useCreateSupportedBodyMutation } = supportedBodiesApi;
