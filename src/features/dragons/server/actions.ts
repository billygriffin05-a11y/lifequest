"use server";
import "server-only";
import { refresh } from "next/cache";
import { prisma } from "@/server/db/client";
import { renameDragon, renameSchema, setDragonPath } from "./service";

export type RenameState = { ok: boolean; message?: string };

export async function renameDragonAction(_prev: RenameState, formData: FormData): Promise<RenameState> {
  const parsed = renameSchema.safeParse({ areaId: formData.get("areaId"), name: String(formData.get("name") ?? "") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid name." };
  const name = await renameDragon(prisma, { areaId: parsed.data.areaId, name: parsed.data.name ?? "" });
  refresh();
  return { ok: true, message: name ? `Your dragon is now called ${name}.` : "Name reset to default." };
}

export async function setDragonPathAction(formData: FormData) {
  const areaId = String(formData.get("areaId") ?? "");
  try {
    await setDragonPath(prisma, areaId, String(formData.get("path") ?? ""));
  } catch {
    // Not old enough or bad input: just refresh without changing anything.
  }
  refresh();
}
