import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = "isPublic";

// Libera a rota da chave da API (ADR 0002). Só o getHealth usa.
export const Public = () => SetMetadata(IS_PUBLIC, true);
