import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Injectable } from "@nestjs/common";
import { env } from "../config/env.js";

const LINK_TTL_SECONDS = 3600;

@Injectable()
export class StorageService {
  private readonly root = resolve(env.UPLOAD_DIR);

  async save(scope: string, id: string, data: Buffer) {
    await mkdir(join(this.root, scope), { recursive: true });
    await writeFile(join(this.root, scope, id), data);
  }

  read(scope: string, id: string) {
    return readFile(join(this.root, scope, id));
  }

  remove(scope: string, id: string) {
    return rm(join(this.root, scope, id), { force: true });
  }

  private sign(scope: string, id: string, exp: number) {
    return createHmac("sha256", env.API_KEY).update(`${scope}/${id}/${exp}`).digest("hex");
  }

  url(scope: string, id: string) {
    const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
    return `${env.API_PUBLIC_URL}/v1/files/${scope}/${id}?exp=${exp}&sig=${this.sign(scope, id, exp)}`;
  }

  verify(scope: string, id: string, exp: string, sig: string) {
    const expected = Buffer.from(this.sign(scope, id, Number(exp)));
    const received = Buffer.from(sig ?? "");
    return Number(exp) > Date.now() / 1000 && expected.length === received.length && timingSafeEqual(expected, received);
  }
}
