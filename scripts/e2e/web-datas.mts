import { errorMessage } from "../../apps/web/src/lib/format.ts";
import { check, done } from "./lib.mts";

// Funções puras da web, sem API.
const one = errorMessage("PREVIOUS_DAY_PENDING", [{ field: "2026-11-22" }]);
check("PREVIOUS_DAY_PENDING com uma data", one === "Falta aprovar o RDO de 22/11 antes deste dia.", one);
const two = errorMessage("PREVIOUS_DAY_PENDING", [{ field: "2026-11-22" }, { field: "2026-11-24" }]);
check("PREVIOUS_DAY_PENDING com duas datas", two === "Falta aprovar o RDO de 22/11 e 24/11 antes deste dia.", two);
check("PREVIOUS_DAY_PENDING sem datas", errorMessage("PREVIOUS_DAY_PENDING") === "Falta aprovar o RDO de um dia anterior antes deste dia.");
check("AI_DISABLED tem texto próprio", errorMessage("AI_DISABLED").startsWith("A IA está desligada"));
done();
