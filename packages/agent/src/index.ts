import type { ValidationResult } from "@argos/rdo-schema";

export interface AgentModel {
  run(request: { name: string; system: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens: number }): Promise<{ output: string }>;
}

export interface EntryInput {
  entryId: string;
  transcript: string | null;
  audioMediaId: string;
  photoMediaIds: string[];
  capturedAt: string;
}

export interface ServiceInput {
  id: string;
  code: string;
  description: string;
  unit: string | null;
}

export interface OpenItemInput {
  id: string;
  title: string;
  kind: string;
  openedOn: string;
}

export interface InterpretEntryInput {
  entry: EntryInput;
  services: ServiceInput[];
  openItems: OpenItemInput[];
}

export interface InterpretEntryResult {
  transcript: string;
  title: string;
  tags: { kind: "activity" | "occurrence" | "labor" | "equipment" | "weather" | "safety"; label: string }[];
  openItemIds: string[];
  questions: { kind: string; text: string; field: string | null; openItemId: string | null; options: { id: string; label: string }[] }[];
}

export interface AssembleReportInput {
  siteType: "private" | "public" | "financed";
  localDate: string;
  entries: (EntryInput & Pick<InterpretEntryResult, "tags" | "openItemIds">)[];
  services: ServiceInput[];
  openItems: OpenItemInput[];
}

export interface AssembleReportResult {
  content: unknown;
  validation: ValidationResult;
}

export class NotImplementedError extends Error {
  constructor(name: string) {
    super(`${name} is not implemented yet (M2).`);
  }
}

export function interpretEntry(_model: AgentModel, _input: InterpretEntryInput): Promise<InterpretEntryResult> {
  return Promise.reject(new NotImplementedError("interpretEntry"));
}

export function assembleReport(_model: AgentModel, _input: AssembleReportInput): Promise<AssembleReportResult> {
  return Promise.reject(new NotImplementedError("assembleReport"));
}
