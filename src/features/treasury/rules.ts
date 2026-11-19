/**
 * Gold rules (pure; tests: tests/unit/treasury.test.ts). Gold is derived:
 * earned = net good-deed Honour + half of all bonus XP + 50 per boss defeated,
 * spent = sum of purchases. Undo lowers earnings automatically.
 */
import { BOSS_GOLD_REWARD } from "@/features/honour/progress";

export function goldEarned(goodHonour: number, bonusXp: number, bossWins: number): number {
  return Math.max(0, goodHonour) + Math.floor(Math.max(0, bonusXp) / 2) + bossWins * BOSS_GOLD_REWARD;
}

export function goldBalance(earned: number, spent: number): number {
  return earned - spent;
}

export function canAfford(balance: number, price: number): boolean {
  return balance >= price;
}
