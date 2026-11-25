import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { DiagnosticsController } from "./diagnostics.controller.js";

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }])],
  controllers: [DiagnosticsController],
})
export class DiagnosticsModule {}
