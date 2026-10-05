import { Module } from "@nestjs/common";
import { SupportedBodiesController } from "./supported-bodies.controller";
import { SupportedBodiesService } from "./supported-bodies.service";

@Module({
  controllers: [SupportedBodiesController],
  providers: [SupportedBodiesService],
})
export class SupportedBodiesModule {}
