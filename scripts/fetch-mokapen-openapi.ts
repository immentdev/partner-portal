/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Scarica l'OpenAPI Mokapen in docs/mokapen-openapi.json
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE = "https://mokapen.com/docs?api-docs.json";
const DEST = path.resolve("docs/mokapen-openapi.json");

async function main() {
  const res = await fetch(SOURCE, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Download OpenAPI fallito: ${res.status}`);
  }
  const json = await res.json();
  await mkdir(path.dirname(DEST), { recursive: true });
  await writeFile(DEST, JSON.stringify(json, null, 2), "utf8");
  const paths = Object.keys(json.paths ?? {}).length;
  console.log(`Salvato ${DEST} (${paths} path)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
