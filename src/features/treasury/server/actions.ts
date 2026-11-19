"use server";
import "server-only";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db/client";
import { buyItem, equipItem, setFavouriteDragon, TreasuryError } from "./service";

const msg = (err: unknown) => (err instanceof TreasuryError ? err.message : "Something went wrong.");

export async function buyItemAction(formData: FormData): Promise<void> {
  let result = "bought";
  try {
    await buyItem(prisma, String(formData.get("itemId") ?? ""));
  } catch (err) {
    result = `error:${encodeURIComponent(msg(err))}`;
  }
  redirect(`/shop?r=${result}`);
}

export async function equipItemAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  const areaId = String(formData.get("areaId") ?? "");
  try {
    await equipItem(prisma, areaId, itemId || null);
  } catch (err) {
    redirect(`/shop?r=error:${encodeURIComponent(msg(err))}`);
  }
  refresh();
}

export async function setFavouriteAction(formData: FormData): Promise<void> {
  await setFavouriteDragon(prisma, String(formData.get("areaId") ?? ""));
  refresh();
}
