import { Controller, Get, Post, Patch, Delete, Body, Query, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  ApiErrorResponses,
  ApiZodBody,
  ApiZodListResponse,
  ApiZodQuery,
  ApiZodResponse,
} from "../common/swagger/zod-openapi";
import {
  contactSchema,
  createContactSchema,
  listContactsQuerySchema,
  updateContactSchema,
  addSupportedBodySchema,
  updateSupportedBodyDomainsSchema,
  deactivateContactSchema,
} from "@contact-management/shared-schemas/contacts";
import type {
  CreateContactInput,
  ListContactsQuery,
  UpdateContactInput,
  AddSupportedBodyInput,
  UpdateSupportedBodyDomainsInput,
  DeactivateContactInput,
} from "@contact-management/shared-schemas/contacts";
import { ContactsService } from "./contacts.service";

@ApiTags("Contacts")
@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: "List contacts (active only unless includeInactive is set), paginated" })
  @ApiZodQuery(listContactsQuerySchema)
  @ApiZodListResponse(contactSchema, "A page of contacts")
  @ApiErrorResponses(400)
  async list(@Query(new ZodValidationPipe(listContactsQuerySchema)) query: ListContactsQuery) {
    const result = await this.contactsService.list(query);
    // Shaped explicitly as {data, meta} — ResponseInterceptor passes through
    // anything that already has a `data` key instead of re-wrapping it.
    return { data: result.items, meta: { total: result.total, page: result.page, pageSize: result.pageSize } };
  }

  @Post()
  @ApiOperation({ summary: "Create a contact linked to one supported body" })
  @ApiZodBody(createContactSchema)
  @ApiZodResponse(201, contactSchema, "The created contact")
  @ApiErrorResponses(400)
  create(@Body(new ZodValidationPipe(createContactSchema)) body: CreateContactInput) {
    return this.contactsService.create(body);
  }

  // Story 1.6 — role/phone/emails/notes/channel prefs only (see
  // UpdateContactInput). Linking a second SupportedBody has its own
  // endpoint below, not a field here.
  @Patch(":id")
  @ApiOperation({ summary: "Partially update a contact's editable fields" })
  @ApiZodBody(updateContactSchema)
  @ApiZodResponse(200, contactSchema, "The updated contact")
  @ApiErrorResponses(400, 404)
  update(@Param("id") id: string, @Body(new ZodValidationPipe(updateContactSchema)) body: UpdateContactInput) {
    return this.contactsService.update(id, body);
  }

  // Story 1.6 — additive sub-resource (many-to-many), not a PATCH field:
  // POST because re-adding an already-linked body is a conflict, not a
  // no-op (expertise-api-rest's action-endpoint decision rule).
  @Post(":id/supported-bodies")
  @ApiOperation({ summary: "Link an additional supported body, with the subset of its domains the contact covers" })
  @ApiZodBody(addSupportedBodySchema)
  @ApiZodResponse(201, contactSchema, "The contact with the new link")
  @ApiErrorResponses(400, 404, 409)
  addSupportedBody(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addSupportedBodySchema)) body: AddSupportedBodyInput,
  ) {
    return this.contactsService.addSupportedBody(id, body.supportedBodyId, body.domainIds);
  }

  // Editing an *existing* link's domain subset — was otherwise only
  // choosable once, at creation/add time.
  @Patch(":id/supported-bodies/:supportedBodyId")
  @ApiOperation({ summary: "Replace the domain subset of an existing supported-body link" })
  @ApiZodBody(updateSupportedBodyDomainsSchema)
  @ApiZodResponse(200, contactSchema, "The contact with the updated link")
  @ApiErrorResponses(400, 404)
  updateSupportedBodyDomains(
    @Param("id") id: string,
    @Param("supportedBodyId") supportedBodyId: string,
    @Body(new ZodValidationPipe(updateSupportedBodyDomainsSchema)) body: UpdateSupportedBodyDomainsInput,
  ) {
    return this.contactsService.updateSupportedBodyDomains(id, supportedBodyId, body.domainIds);
  }

  // The counterpart to the POST above — a link could be added but never
  // removed. No body needed.
  @Delete(":id/supported-bodies/:supportedBodyId")
  @ApiOperation({ summary: "Remove a supported-body link (the last remaining link cannot be removed)" })
  @ApiZodResponse(200, contactSchema, "The contact without the link")
  @ApiErrorResponses(404, 409)
  removeSupportedBody(@Param("id") id: string, @Param("supportedBodyId") supportedBodyId: string) {
    return this.contactsService.removeSupportedBody(id, supportedBodyId);
  }

  // Story 1.7 — action endpoint, not a PATCH field: this is a deliberate
  // state transition with its own mandatory documentation (source+date),
  // not a generic field edit (expertise-api-rest's action-endpoint rule).
  @Post(":id/deactivate")
  @ApiOperation({ summary: "Soft-delete: mark a contact inactive, documenting the external request" })
  @ApiZodBody(deactivateContactSchema)
  @ApiZodResponse(201, contactSchema, "The now-inactive contact")
  @ApiErrorResponses(400, 404)
  deactivate(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(deactivateContactSchema)) body: DeactivateContactInput,
  ) {
    return this.contactsService.deactivate(id, body.source, body.date);
  }

  // Reactivation — symmetric to /deactivate, no body needed (no mandatory
  // documentation the way deactivation has).
  @Post(":id/activate")
  @ApiOperation({ summary: "Reactivate an inactive contact" })
  @ApiZodResponse(201, contactSchema, "The reactivated contact")
  @ApiErrorResponses(404)
  activate(@Param("id") id: string) {
    return this.contactsService.activate(id);
  }
}
