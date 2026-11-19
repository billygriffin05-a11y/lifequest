"use client";

/** Curated emoji choices for good and bad actions, grouped by life area. */
export const EMOJI_GROUPS: readonly { label: string; items: readonly (readonly [string, string])[] }[] = [
  {
    label: "Fitness",
    items: [
      ["🏋️", "Weights"],
      ["🏃", "Running"],
      ["🚴", "Cycling"],
      ["🏊", "Swimming"],
      ["🧘", "Yoga"],
      ["🤸", "Stretching"],
      ["🥾", "Hiking"],
      ["⚽", "Football"],
      ["🥊", "Boxing"],
      ["💪", "Strength"],
    ],
  },
  {
    label: "Food & drink",
    items: [
      ["🥗", "Salad"],
      ["🍎", "Fruit"],
      ["🥦", "Vegetables"],
      ["💧", "Water"],
      ["🍳", "Cooking"],
      ["🍔", "Burger"],
      ["🍕", "Pizza"],
      ["🍟", "Chips"],
      ["🍫", "Chocolate"],
      ["🍺", "Beer"],
      ["🥤", "Fizzy drink"],
      ["☕", "Coffee"],
    ],
  },
  {
    label: "Money",
    items: [
      ["💷", "Pounds"],
      ["💰", "Money bag"],
      ["🐷", "Savings"],
      ["🏦", "Bank"],
      ["📈", "Investing"],
      ["🛍️", "Shopping"],
      ["💳", "Card spend"],
      ["🧾", "Bills"],
    ],
  },
  {
    label: "Study & reading",
    items: [
      ["📖", "Reading"],
      ["📚", "Books"],
      ["🛡️", "Security+"],
      ["💻", "Coding"],
      ["🧠", "Learning"],
      ["✍️", "Writing"],
      ["🎯", "Goal"],
      ["🗣️", "Language"],
    ],
  },
  {
    label: "Sleep & rest",
    items: [
      ["😴", "Sleep"],
      ["🛏️", "Bed on time"],
      ["⏰", "Early alarm"],
      ["🌅", "Sunrise"],
      ["🛁", "Relax"],
    ],
  },
  {
    label: "Good habits",
    items: [
      ["✅", "Done"],
      ["⭐", "Star"],
      ["🔥", "Streak"],
      ["🧹", "Cleaning"],
      ["🪥", "Teeth"],
      ["🌱", "Growth"],
      ["🙏", "Gratitude"],
      ["❤️", "Kindness"],
      ["🐉", "Dragon"],
    ],
  },
  {
    label: "Bad habits",
    items: [
      ["📱", "Phone scrolling"],
      ["🛋️", "Sofa"],
      ["🎮", "Gaming binge"],
      ["📺", "TV binge"],
      ["🚬", "Smoking"],
      ["🍷", "Wine"],
      ["⏳", "Procrastinating"],
      ["😤", "Temper"],
      ["🌙", "Late night"],
      ["💸", "Impulse buy"],
    ],
  },
];

interface Props {
  value: string;
  onPick: (emoji: string) => void;
  /** Used to give the panel an accessible name. */
  idPrefix: string;
}

/** Collapsible grid of tappable emojis (44px targets). */
export function EmojiPicker({ value, onPick, idPrefix }: Props) {
  return (
    <details className="mt-2 rounded-lg border border-obsidian-600 bg-obsidian-950/60">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm text-emerald-300">
        Pick an emoji <span aria-hidden="true">{value}</span>
      </summary>
      <div className="max-h-72 overflow-y-auto px-3 pb-3" role="group" aria-label="Emoji choices" id={`${idPrefix}-emoji-panel`}>
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label} className="mt-2">
            <p className="text-xs uppercase tracking-wider text-silver-300">{group.label}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {group.items.map(([emoji, name]) => {
                const selected = emoji === value;
                return (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={name}
                    aria-pressed={selected}
                    title={name}
                    onClick={() => onPick(emoji)}
                    className={`flex h-11 w-11 items-center justify-center rounded-lg border text-2xl transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-400 ${
                      selected ? "border-gold-500 bg-gold-500/15" : "border-transparent hover:border-obsidian-600"
                    }`}
                  >
                    <span aria-hidden="true">{emoji}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
