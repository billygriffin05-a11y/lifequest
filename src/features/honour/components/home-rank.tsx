import { connection } from "next/server";
import { prisma } from "@/server/db/client";
import { getPlayerProgress } from "../server/service";
import { RankCard } from "./rank-card";

/** The player's rank on the home page (read at request time). */
export async function HomeRank() {
  await connection();
  const progress = await getPlayerProgress(prisma);
  return <RankCard rank={progress.rank} bonusXp={progress.bonusXp} className="mt-6 text-left" />;
}
