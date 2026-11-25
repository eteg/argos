import { Global, Module } from "@nestjs/common";
import { ProcessingService } from "./processing.service.js";

@Global()
@Module({ providers: [ProcessingService], exports: [ProcessingService] })
export class ProcessingModule {}
