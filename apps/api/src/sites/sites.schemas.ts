import { z } from "zod";

const text = z.string().trim().min(1);
const dateOnly = z.iso.date();
const party = z.object({ name: text, taxId: text });
const location = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracyMeters: z.number().optional() });

export const siteType = z.enum(["private", "public", "financed"]);
export const siteStatus = z.enum(["not_started", "in_progress", "paused", "completed"]);
export const documentType = z.enum([
  "architectural", "structural", "plumbing", "electrical_telecom", "hvac", "fire_protection", "as_built",
]);

const publicContract = z.object({
  number: text,
  commitmentOrAgreement: text,
  inspectorName: text,
  serviceOrderDate: dateOnly,
  durationDays: z.number().int().min(1),
  amendments: z.array(z.object({ description: text, addedDays: z.number().int(), signedOn: dateOnly })).optional(),
});

const siteFields = {
  name: text,
  type: siteType,
  address: text,
  location,
  client: party,
  contractor: party,
  technicalManager: z.object({ name: text, artNumber: text }),
  publicContract,
};

export const createSiteSchema = z.object({ ...siteFields, location: location.optional(), publicContract: publicContract.optional() });
export const updateSiteSchema = z.object(siteFields).partial();
export const changeStatusSchema = z.object({ status: siteStatus });
export const equipmentSchema = z.object({ name: text, identifier: z.string().trim().min(1).nullish() });
export const updateEquipmentSchema = equipmentSchema.partial();
export const updateDocumentSchema = z.object({ type: documentType });
export const uuid = z.uuid();
