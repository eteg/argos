import { Global, Module } from "@nestjs/common";
import { AiClientService } from "./ai-client.service.js";
import { TranscriptionService } from "./transcription.service.js";
import { langfuseProvider } from "./langfuse.provider.js";

@Global()
@Module({
  providers: [langfuseProvider, AiClientService, TranscriptionService],
  exports: [AiClientService, TranscriptionService],
})
export class AiModule {}
