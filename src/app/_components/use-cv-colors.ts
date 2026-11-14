"use client";

import { api } from "~/trpc/react";
import { cvColor } from "./ui";

/** Couleur de chaque CV (par id), fixée par l'ordre de création : un CV garde sa couleur partout. */
export function useCvColors() {
  const cvs = api.cv.list.useQuery();
  const colors = new Map((cvs.data ?? []).map((c, i) => [c.id, cvColor(i)]));
  return { cvs: cvs.data ?? [], color: (id: string | null | undefined) => (id && colors.get(id)) || "#898781" };
}
