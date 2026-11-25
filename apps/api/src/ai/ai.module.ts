import { Global, Module } from "@nestjs/common";
import { AiClientService } from "./ai-client.service.js";
import { langfuseProvider } from "./langfuse.provider.js";

@Global()
@Module({
  providers: [langfuseProvider, AiClientService],
  exports: [AiClientService],
})
export class AiModule {}
