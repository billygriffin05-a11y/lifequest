import type { ActionInput } from "./schemas";

/** Optional examples offered on an empty list. Fully editable after adding. */
export const STARTER_ACTIONS: readonly ActionInput[] = [
  { name: "Gym session", kind: "good", points: 20, icon: "🏋️", category: "Fitness" },
  { name: "Went for a run", kind: "good", points: 20, icon: "🏃", category: "Fitness" },
  { name: "Read for 30 minutes", kind: "good", points: 10, icon: "📖", category: "Reading" },
  { name: "Security+ study session", kind: "good", points: 15, icon: "🛡️", category: "Study" },
  { name: "Cooked a healthy meal", kind: "good", points: 10, icon: "🥗", category: "Nutrition" },
  { name: "Takeaway", kind: "bad", points: 15, icon: "🍔", category: "Nutrition" },
  { name: "Skipped a workout", kind: "bad", points: 10, icon: "🛋️", category: "Fitness" },
  { name: "Impulse purchase", kind: "bad", points: 15, icon: "🛍️", category: "Finance" },
];
