---
name: frontend
description: LIFEQUEST UI work — pages, components, styling, animations, PWA, responsive iPhone/Windows layouts and accessibility. Use whenever creating or changing anything under src/app or src/components or src/features/*/components.
---

# LIFEQUEST frontend

1. **Read first:** the relevant guide in `node_modules/next/dist/docs/` (Next.js 16 differs from older versions), existing components in `src/components`, and tokens in `src/app/globals.css`.
2. **Server Components by default.** Add `"use client"` only for interactivity, and keep client islands small. Never import from `src/server/**` in client code.
3. **Design language:** dark fantasy, premium. Obsidian surfaces (`bg-obsidian-900/950`), gold for headings, rewards and premium accents (`text-gold-300`, `border-gold-500/30`), emerald for progress and success, silver for text. Use Cinzel (`font-display`) for headings only and Inter for body text. No raw hex values in components.
4. **Responsive:** mobile-first. Test 375px (iPhone) and 1440px. Respect safe areas (`env(safe-area-inset-*)`), use 44px minimum touch targets, and never allow horizontal scroll.
5. **Accessibility (WCAG 2.1 AA):** semantic landmarks, one `h1` per page, labelled controls, visible focus rings (emerald), contrast of at least 4.5:1, keyboard-operable, and status announced via `aria-live` for XP and reward toasts.
6. **Motion:** animate only `transform` and `opacity`, keep to ≤300ms for UI feedback, and honour `prefers-reduced-motion` (already global). Celebrate rewards without blocking input.
7. **Reuse:** check `src/components/ui` before creating a component. Put a new shared primitive there; feature-specific components go in `src/features/<domain>/components`.
8. **Copy:** British English, encouraging RPG tone, and plain language for money and health numbers.
9. **Verify:** `npm run lint && npm run typecheck && npm run build && npm run test:e2e`. Add an e2e test that includes an axe check for new pages.
