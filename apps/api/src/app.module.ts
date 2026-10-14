import { Module } from "@nestjs/common";
import { DomainsModule } from "./domains/domains.module";
import { SupportedBodiesModule } from "./supported-bodies/supported-bodies.module";
import { ContactsModule } from "./contacts/contacts.module";
import { HealthModule } from "./health/health.module";
import { AppLifecycle } from "./app.lifecycle";

@Module({
  imports: [DomainsModule, SupportedBodiesModule, ContactsModule, HealthModule],
  providers: [AppLifecycle],
})
export class AppModule {}
