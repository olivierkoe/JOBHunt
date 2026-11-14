/**
 * Importe prisma/contacts.json : fiche de chaque entreprise (secteur, adresse, téléphone et email publics)
 * et ses contacts publics trouvés en ligne.
 * Rejouable : les contacts d'une entreprise présente dans le fichier sont remplacés.
 * contacts.json n'est pas versionné (noms de personnes réelles) : sans lui, on importe contacts.example.json.
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { companyKey } from "../src/lib/skills";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

type Entry = {
  company: string;
  website?: string;
  note?: string;
  sector?: string;
  address?: string;
  country?: string;
  phone?: string;
  email?: string;
  infoSource?: string;
  contacts: { role: string; name?: string; email?: string; url?: string; source?: string; verified?: boolean }[];
};

async function main() {
  const own = new URL("./contacts.json", import.meta.url);
  const file = existsSync(own) ? own : new URL("./contacts.example.json", import.meta.url);
  const entries = JSON.parse(readFileSync(file, "utf8")) as Entry[];
  let contacts = 0;
  for (const e of entries) {
    const key = companyKey(e.company);
    const data = {
      name: e.company.trim(),
      website: e.website ?? null,
      note: e.note ?? null,
      sector: e.sector ?? null,
      address: e.address ?? null,
      country: e.country ?? null,
      phone: e.phone ?? null,
      email: e.email ?? null,
      infoSource: e.infoSource ?? null,
    };
    await db.$transaction([
      db.company.upsert({ where: { key }, create: { key, ...data }, update: data }),
      db.contact.deleteMany({ where: { companyKey: key } }),
      db.contact.createMany({ data: e.contacts.map((c) => ({ companyKey: key, ...c })) }),
    ]);
    contacts += e.contacts.length;
  }
  console.log(`Contacts : ${entries.length} entreprises, ${contacts} contacts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void db.$disconnect());
