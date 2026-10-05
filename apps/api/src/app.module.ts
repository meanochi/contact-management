import { Module } from "@nestjs/common";
import { DomainsModule } from "./domains/domains.module";
import { SupportedBodiesModule } from "./supported-bodies/supported-bodies.module";
import { ContactsModule } from "./contacts/contacts.module";

@Module({
  imports: [DomainsModule, SupportedBodiesModule, ContactsModule],
})
export class AppModule {}
