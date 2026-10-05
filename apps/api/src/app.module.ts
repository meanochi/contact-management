import { Module } from "@nestjs/common";
import { DomainsModule } from "./domains/domains.module";
import { SupportedBodiesModule } from "./supported-bodies/supported-bodies.module";

@Module({
  imports: [DomainsModule, SupportedBodiesModule],
})
export class AppModule {}
