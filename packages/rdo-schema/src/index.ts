import { z } from "zod";

// Esqueleto do schema do RDO (RG06). Os campos da matriz do guia entram na entrega "Schema do RDO" do M0.
export const workTypeSchema = z.enum(["private", "public", "financed"]);

export const rdoSchema = z.object({
  date: z.iso.date(),
  workType: workTypeSchema,
});

export type Rdo = z.infer<typeof rdoSchema>;
