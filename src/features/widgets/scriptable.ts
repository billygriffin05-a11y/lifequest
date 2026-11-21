/**
 * The Scriptable (iPhone) widget script, with the app's address filled in.
 * One script serves every widget: home screen small / medium / large and the
 * lock screen (rectangular, circular, inline). The widget's "Parameter"
 * picks what to show: today (default), calendar, dragon.
 * Tests: tests/unit/widgets.test.ts
 */
export function scriptableScript(baseUrl: string): string {
  const url = JSON.stringify(`${baseUrl.replace(/\/$/, "")}/api/widget`);
  const app = JSON.stringify(baseUrl.replace(/\/$/, ""));
  return `// LIFEQUEST widget — paste into Scriptable, then add a Scriptable widget and choose this script.
// Widget "Parameter": today (default), calendar or dragon.
const FEED = ${url};
const APP = ${app};
const C = { bg: new Color("#0c0618"), panel: new Color("#1f1240"), pink: new Color("#ff64e1"), aqua: new Color("#3ef5c4"), yellow: new Color("#ffd23f"), text: new Color("#f3edff"), dim: new Color("#cdc2f0") };
const mode = ((args.widgetParameter || "today") + "").trim().toLowerCase();
const fam = config.widgetFamily || "medium";
const lock = fam.startsWith("accessory");

async function load() {
  try {
    const r = new Request(FEED);
    r.timeoutInterval = 15;
    const d = await r.loadJSON();
    if (d && d.rank) return d;
  } catch (e) {}
  return null;
}

function when(e) {
  const today = new Date().toISOString().slice(0, 10);
  const label = e.day === today ? "Today" : new Date(e.day + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
  return e.time ? label + " " + e.time : label;
}

function txt(stack, s, size, color, bold) {
  const t = stack.addText(String(s));
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  if (!lock) t.textColor = color || C.text;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.7;
  return t;
}

function build(d) {
  const w = new ListWidget();
  w.url = APP + (mode === "calendar" ? "/calendar" : mode === "dragon" ? "/dragons" : "/honour");
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  if (!lock) { w.backgroundColor = C.bg; w.setPadding(12, 12, 12, 12); }
  if (!d) { txt(w, lock ? "LIFEQUEST offline" : "LIFEQUEST\\nPC offline or Tailscale off", 12, C.dim); return w; }

  if (fam === "accessoryInline") {
    txt(w, mode === "calendar" && d.events[0] ? "📅 " + d.events[0].title : "🔥 " + d.bestStreak + " · ⚔️ " + d.quests.done + "/" + d.quests.total, 12);
    return w;
  }
  if (fam === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
    txt(s, mode === "calendar" ? "📅" : "⚔️", 12);
    txt(s, mode === "calendar" ? d.events.filter((e) => e.day === new Date().toISOString().slice(0, 10)).length : d.quests.done + "/" + d.quests.total, 14, null, true);
    return w;
  }
  if (fam === "accessoryRectangular") {
    if (mode === "calendar") {
      txt(w, "📅 Next up", 11, null, true);
      for (const e of d.events.slice(0, 2)) txt(w, when(e) + " · " + e.title, 11);
      if (!d.events.length) txt(w, "Nothing coming up", 11);
    } else {
      txt(w, d.rank.title + " · Lv " + d.rank.level, 12, null, true);
      txt(w, "⚔️ " + d.quests.done + "/" + d.quests.total + "  🔥 " + d.bestStreak + "  🃏 " + d.cardsDue, 12);
      txt(w, (d.boss.defeated ? "Boss defeated" : d.boss.emoji + " " + d.boss.hpLeft + " HP left"), 11);
    }
    return w;
  }

  // Home screen
  txt(w, "LIFEQUEST", 11, C.pink, true);
  w.addSpacer(4);
  if (mode === "calendar") {
    const n = fam === "small" ? 3 : fam === "medium" ? 3 : 7;
    if (!d.events.length) txt(w, "Nothing in the next two weeks", 12, C.dim);
    for (const e of d.events.slice(0, n)) { txt(w, when(e), 10, C.aqua); txt(w, e.title, 13); }
  } else if (mode === "dragon" && d.dragon) {
    txt(w, "🐉 " + d.dragon.name, 15, C.text, true);
    txt(w, d.dragon.stage + " · " + d.dragon.mood, 12, C.dim);
    w.addSpacer(4);
    txt(w, d.boss.defeated ? "Boss defeated ✓" : d.boss.emoji + " " + d.boss.name + " · " + d.boss.hpLeft + "/" + d.boss.hp, 11, C.yellow);
  } else {
    txt(w, d.rank.title + " · Lv " + d.rank.level, 15, C.text, true);
    txt(w, d.rank.xp + " XP · " + (d.honourToday >= 0 ? "+" : "") + d.honourToday + " today", 11, C.dim);
    w.addSpacer(4);
    txt(w, "⚔️ Quests " + d.quests.done + "/" + d.quests.total + "   🔥 " + d.bestStreak, 12, C.aqua);
    if (fam !== "small") txt(w, "🃏 " + d.cardsDue + " cards   💧 " + d.water.glasses + "/" + d.water.goal, 12, C.text);
    if (fam === "large") {
      w.addSpacer(6);
      txt(w, d.boss.defeated ? "Boss defeated ✓" : d.boss.emoji + " " + d.boss.name + " · " + d.boss.hpLeft + " HP", 12, C.yellow);
      w.addSpacer(6);
      txt(w, "Coming up", 11, C.pink, true);
      for (const e of d.events.slice(0, 4)) txt(w, when(e) + " · " + e.title, 12);
    }
  }
  w.addSpacer();
  return w;
}

const data = await load();
const widget = build(data);
if (config.runsInWidget) Script.setWidget(widget);
else if (lock) await widget.presentAccessoryRectangular();
else await widget.presentMedium();
Script.complete();
`;
}
