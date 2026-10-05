import { Controller, Get, Post, Patch, Body, Query, Param } from "@nestjs/common";
import { JoiValidationPipe } from "../common/pipes/joi-validation.pipe";
import {
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

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async list(@Query(new JoiValidationPipe(listContactsQuerySchema)) query: ListContactsQuery) {
    const result = await this.contactsService.list(query);
    // Shaped explicitly as {data, meta} — ResponseInterceptor passes through
    // anything that already has a `data` key instead of re-wrapping it.
    return { data: result.items, meta: { total: result.total, page: result.page, pageSize: result.pageSize } };
  }

  @Post()
  create(@Body(new JoiValidationPipe(createContactSchema)) body: CreateContactInput) {
    return this.contactsService.create(body);
  }

  // Story 1.6 — role/phone/emails/notes/channel prefs only (see
  // UpdateContactInput). Linking a second SupportedBody has its own
  // endpoint below, not a field here.
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new JoiValidationPipe(updateContactSchema)) body: UpdateContactInput,
  ) {
    return this.contactsService.update(id, body);
  }

  // Story 1.6 — additive sub-resource (many-to-many), not a PATCH field:
  // POST because re-adding an already-linked body is a conflict, not a
  // no-op (expertise-api-rest's action-endpoint decision rule).
  @Post(":id/supported-bodies")
  addSupportedBody(
    @Param("id") id: string,
    @Body(new JoiValidationPipe(addSupportedBodySchema)) body: AddSupportedBodyInput,
  ) {
    return this.contactsService.addSupportedBody(id, body.supportedBodyId, body.domainIds);
  }

  // Requested by Rachel: editing an *existing* link's domain subset — was
  // otherwise only choosable once, at creation/add time.
  @Patch(":id/supported-bodies/:supportedBodyId")
  updateSupportedBodyDomains(
    @Param("id") id: string,
    @Param("supportedBodyId") supportedBodyId: string,
    @Body(new JoiValidationPipe(updateSupportedBodyDomainsSchema)) body: UpdateSupportedBodyDomainsInput,
  ) {
    return this.contactsService.updateSupportedBodyDomains(id, supportedBodyId, body.domainIds);
  }

  // Story 1.7 — action endpoint, not a PATCH field: this is a deliberate
  // state transition with its own mandatory documentation (source+date),
  // not a generic field edit (expertise-api-rest's action-endpoint rule).
  @Post(":id/deactivate")
  deactivate(
    @Param("id") id: string,
    @Body(new JoiValidationPipe(deactivateContactSchema)) body: DeactivateContactInput,
  ) {
    return this.contactsService.deactivate(id, body.source, body.date);
  }

  // Reactivation — symmetric to /deactivate, no body needed (no mandatory
  // documentation the way deactivation has).
  @Post(":id/activate")
  activate(@Param("id") id: string) {
    return this.contactsService.activate(id);
  }
}
