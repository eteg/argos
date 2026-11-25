import { Module } from "@nestjs/common";
import { EngineerController } from "./engineer.controller.js";

@Module({ controllers: [EngineerController] })
export class EngineerModule {}
