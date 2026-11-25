import { z } from "zod";
import {
  activityStatusSchema,
  employmentSchema,
  equipmentStatusSchema,
  historyActorSchema,
  laborCategorySchema,
  mediaKindSchema,
  mediaSourceSchema,
  occurrenceStatusSchema,
  occurrenceTypeSchema,
  openItemKindSchema,
  openItemOutcomeSchema,
  questionKindSchema,
  questionStatusSchema,
  reportStatusSchema,
  safetyTypeSchema,
  shiftSchema,
  siteTypeSchema,
  weatherSchema,
  workConditionSchema,
} from "./enums.js";
import { field, list } from "./meta.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const instantSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
const textSchema = z.string();
const idSchema = z.string();

const locationSchema = z.strictObject({
  lat: z.number(),
  lng: z.number(),
  accuracyMeters: z.number().nullable(),
});

const siteSchema = z.strictObject({
  name: field(textSchema, "universal", "site", "Nome da obra"),
  type: field(siteTypeSchema, "universal", "site", "Tipo da obra"),
  address: field(textSchema, "universal", "site", "Endereço da obra"),
  client: field(
    z.strictObject({
      name: field(textSchema, "universal", "site", "Nome do cliente"),
      taxId: field(textSchema, "universal", "site", "CNPJ do cliente"),
    }),
    "universal",
    "site",
    "Cliente ou contratante",
  ),
  contractor: field(
    z.strictObject({
      name: field(textSchema, "universal", "site", "Nome da contratada"),
      taxId: field(textSchema, "universal", "site", "CNPJ da contratada"),
    }),
    "universal",
    "site",
    "Contratada",
  ),
  technicalManager: field(
    z.strictObject({
      name: field(textSchema, "universal", "site", "Nome do responsável técnico"),
      artNumber: field(textSchema, "universal", "site", "Número da ART"),
    }),
    "universal",
    "site",
    "Responsável técnico",
  ),
  publicContract: field(
    z.strictObject({
      number: field(textSchema, "public_financed", "site", "Número do contrato"),
      commitmentOrAgreement: field(
        textSchema,
        "public_financed",
        "site",
        "Empenho ou convênio",
      ),
      inspectorName: field(textSchema, "public_financed", "site", "Fiscal do contrato"),
      serviceOrderDate: field(dateSchema, "public_financed", "site", "Ordem de serviço"),
      durationDays: field(z.int(), "public_financed", "site", "Prazo contratual"),
      amendments: list(
        z.array(
          z.strictObject({
            id: idSchema,
            description: textSchema,
            addedDays: z.int(),
            signedOn: dateSchema,
          }),
        ),
        "public_financed",
        "site",
        "Aditivos",
      ),
      elapsedDays: field(z.int(), "public_financed", "site", "Prazo decorrido"),
      remainingDays: field(z.int(), "public_financed", "site", "Prazo restante"),
    }),
    "public_financed",
    "site",
    "Contrato público",
  ),
});

const mediaFields = {
  id: field(idSchema, "universal", "report", "Identificador da foto"),
  kind: field(mediaKindSchema, "universal", "report", "Tipo de mídia"),
  source: field(mediaSourceSchema, "universal", "report", "Origem da mídia"),
  capturedAt: field(instantSchema, "universal", "report", "Momento da captura"),
  location: field(locationSchema, "recommended", "report", "Local da captura"),
  durationSeconds: field(z.int(), "recommended", "report", "Duração"),
  url: field(textSchema, "universal", "report", "Endereço da mídia"),
};

const photoSchema = z.strictObject({
  ...mediaFields,
  caption: field(textSchema, "recommended", "report", "Legenda da foto"),
  linkedTo: field(
    z.strictObject({
      type: z.enum(["activity", "occurrence"]),
      id: idSchema,
    }),
    "recommended",
    "report",
    "Vínculo da foto",
  ),
});

const weatherEntrySchema = z.strictObject({
  shift: field(shiftSchema, "universal", "report", "Turno"),
  weather: field(weatherSchema, "universal", "report", "Clima"),
  condition: field(workConditionSchema, "universal", "report", "Condição de trabalho"),
});

const laborEntrySchema = z.strictObject({
  role: field(textSchema, "universal", "report", "Função"),
  count: field(z.int().min(0), "universal", "report", "Quantidade"),
  employment: field(employmentSchema, "universal", "report", "Vínculo"),
  company: field(textSchema, "universal", "report", "Empresa terceirizada", {
    conditional: true,
  }),
  category: field(laborCategorySchema, "recommended", "report", "Categoria"),
});

const equipmentEntrySchema = z.strictObject({
  equipmentId: field(idSchema, "public_financed", "report", "Equipamento"),
  name: field(textSchema, "public_financed", "report", "Nome do equipamento"),
  identifier: field(textSchema, "public_financed", "report", "Prefixo ou placa"),
  status: field(equipmentStatusSchema, "public_financed", "report", "Situação do equipamento"),
  operatingHours: field(z.number().min(0), "recommended", "report", "Horas em operação"),
});

const activitySchema = z.strictObject({
  id: idSchema,
  description: field(textSchema, "universal", "report", "Descrição da atividade"),
  service: field(
    z.strictObject({
      id: idSchema,
      code: textSchema,
      description: textSchema,
      unit: textSchema.nullable(),
    }),
    "universal",
    "report",
    "Serviço da planilha",
  ),
  location: field(textSchema, "universal", "report", "Local da atividade"),
  status: field(activityStatusSchema, "universal", "report", "Situação da atividade"),
  quantity: field(z.number(), "public_financed", "report", "Quantidade executada"),
  unit: field(textSchema, "public_financed", "report", "Unidade"),
  cumulativeProgressPercent: field(
    z.number().min(0).max(100),
    "recommended",
    "report",
    "Avanço acumulado",
  ),
  executor: field(textSchema, "recommended", "report", "Executor"),
});

const occurrenceSchema = z.strictObject({
  id: idSchema,
  type: field(occurrenceTypeSchema, "universal", "report", "Tipo da ocorrência"),
  description: field(textSchema, "universal", "report", "Descrição da ocorrência"),
  startTime: field(timeSchema, "universal", "report", "Início da ocorrência"),
  endTime: field(timeSchema, "universal", "report", "Fim da ocorrência", {
    conditional: true,
  }),
  status: field(occurrenceStatusSchema, "universal", "report", "Situação da ocorrência"),
  affectedServiceIds: list(
    z.array(idSchema),
    "public_financed",
    "report",
    "Serviços afetados",
  ),
  source: field(
    z.strictObject({
      origin: textSchema,
      document: textSchema,
    }),
    "public_financed",
    "report",
    "Fonte da ordem ou comunicação",
  ),
  safety: field(
    z.strictObject({
      type: safetyTypeSchema,
      dds: z.boolean(),
      ppeInUse: z.boolean(),
    }),
    "recommended",
    "report",
    "Segurança do trabalho",
    { conditional: true },
  ),
  materials: field(textSchema, "recommended", "report", "Materiais"),
});

export const reportContentSchema = z.strictObject({
  site: siteSchema,
  localDate: field(dateSchema, "universal", "report", "Data do RDO"),
  workday: field(
    z.strictObject({
      startTime: field(timeSchema, "universal", "report", "Início da jornada"),
      endTime: field(timeSchema, "universal", "report", "Fim da jornada"),
      breakMinutes: field(z.int().min(0), "universal", "report", "Intervalo"),
    }),
    "universal",
    "report",
    "Jornada de trabalho",
  ),
  weather: list(z.array(weatherEntrySchema), "universal", "report", "Condição climática", {
    nonEmpty: true,
  }),
  weatherStoppage: field(
    z.strictObject({
      hours: field(z.number().min(0), "public_financed", "report", "Horas paradas por clima"),
      serviceIds: list(z.array(idSchema), "public_financed", "report", "Serviços afetados"),
    }),
    "public_financed",
    "report",
    "Paralisação por clima",
  ),
  rainfallMm: field(z.number().min(0), "recommended", "report", "Pluviometria"),
  labor: list(z.array(laborEntrySchema), "universal", "report", "Efetivo", { nonEmpty: true }),
  laborNotes: field(textSchema, "recommended", "report", "Observações do efetivo"),
  equipment: list(z.array(equipmentEntrySchema), "public_financed", "report", "Equipamentos"),
  activities: list(z.array(activitySchema), "universal", "report", "Atividades", {
    nonEmpty: true,
  }),
  occurrences: list(z.array(occurrenceSchema), "universal", "report", "Ocorrências"),
  openItemReviews: list(
    z.array(
      z.strictObject({
        openItemId: idSchema,
        outcome: openItemOutcomeSchema,
        note: textSchema.nullable(),
      }),
    ),
    "recommended",
    "report",
    "Pendências dos dias anteriores",
  ),
  newOpenItems: list(
    z.array(
      z.strictObject({
        id: idSchema,
        title: textSchema,
        kind: openItemKindSchema,
        track: z.boolean(),
      }),
    ),
    "recommended",
    "report",
    "Novas pendências",
  ),
  photos: list(z.array(photoSchema), "universal", "report", "Fotos"),
});

const questionSchema = z.strictObject({
  id: idSchema,
  kind: questionKindSchema,
  text: textSchema,
  field: textSchema.nullable(),
  openItemId: idSchema.nullable(),
  options: z.array(z.strictObject({ id: idSchema, label: textSchema })),
  status: questionStatusSchema,
  answer: z
    .strictObject({
      optionId: idSchema.nullable(),
      text: textSchema.nullable(),
      audioMediaId: idSchema.nullable(),
      answeredAt: instantSchema,
    })
    .nullable(),
});

const linkedToSchema = z.strictObject({
  type: z.enum(["activity", "occurrence"]),
  id: idSchema,
});

export const reportSchema = z.strictObject({
  ...reportContentSchema.shape,
  id: idSchema,
  siteId: idSchema,
  number: z.int().min(1),
  status: reportStatusSchema,
  entriesCount: z.int().min(0),
  questions: z.array(questionSchema),
  missingFields: z.array(
    z.strictObject({ field: textSchema, questionId: idSchema.nullable() }),
  ),
  photoRequirements: z.array(z.strictObject({ linkedTo: linkedToSchema, label: textSchema })),
  approval: z
    .strictObject({ approvedBy: textSchema, approvedAt: instantSchema })
    .nullable(),
  history: list(
    z.array(
      z.strictObject({
        at: instantSchema,
        actor: historyActorSchema,
        description: textSchema,
      }),
    ),
    "public_financed",
    "report",
    "Histórico de alterações",
  ),
  pdfUrl: textSchema.nullable(),
});

export type ReportContent = z.infer<typeof reportContentSchema>;
export type Report = z.infer<typeof reportSchema>;
