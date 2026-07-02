# Sidebar app shell + Alerts page redesign — Design

**Date:** 2026-07-02
**Status:** Approved (pending spec review)

## Problem

Two related UX problems:

1. **Feature prominence.** Alerts and Saves are surfaced only as bare, icon-only
   entries (a bell and a heart) in the top-right of every protected page. Nothing
   communicates what they are or how central they are to the product.
2. **The Alerts page reads as messy.** It stacks many loose small-text rows —
   a page header, a full-width 50/50 tab bar, a centered description strip, an
   in-body count line, a search+refresh row, a progress bar, a large summary
   card, and a "last refreshed" line — before any content.

## Goals

- Make Alerts and Saves feel like first-class features via a persistent,
  labeled, retractable **left sidebar** that becomes the app's shared chrome.
- Work correctly on mobile (drawer presentation).
- Make the Alerts page cohesive with the rest of the app by collapsing its
  stacked header zones into a single action bar.
- Add an "Active alerts" stat to the existing profile dashboard.

## Non-goals

- No redesign of the individual listing/watch cards (they are already fine).
- No change to the search flow, streaming endpoints, or scraping.
- No splitting of Tracked listings / Search alerts into separate pages — they
  stay together on `/alerts` under a tabbed toolbar.

## Current state (what exists today)

- **No shared chrome.** `(protected)/layout.tsx` only runs the auth gate and
  mounts data providers (`SavesProvider`, `WatchlistProvider`,
  `SearchHistoryProvider`) plus the `Toaster`. It renders no UI.
- Each protected route draws its **own** top nav:
  - `alerts/layout.tsx`, `saves/layout.tsx`, `watchlist/layout.tsx` render a
    `<nav>` with `<Wordmark>` + `<AuthButton>`.
  - `search/page.tsx`, `profile/page.tsx`, `settings/page.tsx`,
    `search-history/page.tsx` render `<AuthButton>` inline inside the page.
- **`app/components/AuthButton.tsx`** is the top-right control cluster:
  1. Tracks the Supabase auth user (`getUser` + `onAuthStateChange`); shows a
     loading skeleton, a "Sign in" link when logged out, or the cluster when
     logged in; fires a "session expired" toast on unexpected sign-out.
  2. `useBillingPlan` hook (`/api/billing/status`) → shows an Upgrade pill for
     free-plan users.
  3. `useTotalUnreadAlerts` hook → bell icon linking to `/alerts` with a live
     unread badge (realtime subscription on the `notifications` table).
  4. Heart icon linking to `/saves`.
  5. Avatar dropdown: email, Profile, Settings, Pricing, Sign out; click-outside
     and Escape handling; sign-out calls `markIntentionalSignOut()`.
  - `markIntentionalSignOut` is also imported by `settings/page.tsx` — the
    export must be preserved.
- **Alerts page** = `alerts/layout.tsx` (nav + big "Alerts" header + subtitle) →
  `AlertsTabsClient.tsx` (full-width 50/50 tab bar → centered description strip →
  tab content). Tabs: `WatchlistTab` (Tracked listings) and `SearchAlertsTab`.
- **Profile dashboard** (`ProfileDashboard.tsx`) already has a stats strip
  (Searches this month · Items saved · Listings watched), recent searches, top
  platforms, and mini saves/watchlist cards. No search-alerts stat.

## Design

### 1. App shell — retractable left sidebar

Introduce the app's first shared chrome in `(protected)/layout.tsx`.

**New components (`app/components/shell/`):**

- **`AppShell.tsx`** (client) — owns collapse state (persisted to
  `localStorage`, default expanded on desktop), owns mobile drawer open/close
  state, tracks the auth user + session-expired toast (moved out of
  `AuthButton`), and lays out `[sidebar | content]` on desktop and
  `[topbar over content, drawer overlay]` on mobile.
- **`AppSidebar.tsx`** — the nav surface, used both as the fixed desktop rail and
  the contents of the mobile drawer.

**Sidebar contents (top → bottom):**

- **Wordmark** → `/search`.
- **Primary nav rows**, each an icon **+ label** with active-state highlight via
  `usePathname()`:
  - Search (`/search`)
  - Alerts (`/alerts`) — with the unread badge from `useTotalUnreadAlerts`
  - Saves (`/saves`)
  - Search history (`/search-history`)
- **Spacer**, then **footer**:
  - `Upgrade` pill/link (free plan only), from `useBillingPlan`.
  - `Home` link → `/` (marketing landing, which links to `/blog` and the rest).
  - **Account section**: avatar + email opening the existing menu
    (Profile / Settings / Pricing / Sign out).
- **Collapse/expand toggle** (chevron). Collapsed = icon-only rail with hover
  tooltips; expanded = icons + labels.

**Responsive behavior:**

- `>= lg`: fixed left sidebar; content area sits to its right. Collapsed vs
  expanded controlled by the toggle and persisted.
- `< lg`: sidebar hidden; a slim top bar shows Wordmark + hamburger + the unread
  badge. Hamburger opens `AppSidebar` as a drawer overlay (with backdrop, Escape
  to close, focus trap). Same nav items and badges.

**Content layout:** protected pages currently use centered `max-w-*  mx-auto`
containers assuming full width. The shell provides the left offset; page
containers stay centered within the remaining content area. Verify no
double-padding / horizontal scroll.

### 2. AuthButton migration

Extract the reusable pieces so both desktop sidebar and mobile drawer share
them, and so `settings/page.tsx` keeps working:

- Move `useTotalUnreadAlerts`, `useBillingPlan`, and `markIntentionalSignOut`
  into a shared module (e.g. `app/components/shell/nav-hooks.ts`), re-exporting
  `markIntentionalSignOut` so `settings/page.tsx`'s import path can be updated in
  one place.
- Map the old cluster onto the sidebar: bell badge → Alerts row; heart → Saves
  row; Upgrade pill → footer; avatar dropdown → footer account section;
  auth-state tracking + session-expired toast → `AppShell`.
- Remove the standalone `<AuthButton>` usages and per-page `<nav>` blocks from:
  `alerts/layout.tsx`, `saves/layout.tsx`, `watchlist/layout.tsx` (layouts) and
  `search/page.tsx`, `profile/page.tsx`, `settings/page.tsx`,
  `search-history/page.tsx` (inline). After migration nothing renders
  `AuthButton`; delete the component (its logic now lives in the shell/shared
  module).

### 3. Alerts page — unified toolbar

Rework `AlertsTabsClient.tsx` (and light edits to `WatchlistTab.tsx` /
`SearchAlertsTab.tsx`) into a single action bar:

- **Left:** compact, left-aligned **pill/segmented tabs** with count badges —
  `Tracked 12` · `Alerts 3`. Replaces the full-width 50/50 tab bar and removes
  the redundant in-body count lines.
- **Right (contextual):** Tracked tab → `[search…] [Refresh prices]`;
  Search-alerts tab → `[+ New alert]`.
- **Status row:** a single subtle inline chip line under the toolbar
  ("9 active · 3 sold · refreshed 2m ago") replacing the several stacked
  status/last-refreshed lines.
- **Progress + summary:** the refresh progress bar and post-refresh summary
  collapse into one slim, dismissible **inline banner** (one line) instead of the
  current large card block.
- **Header:** remove the centered description strip
  (`AlertsTabsClient` lines ~59–67); shrink or drop the big page header in
  `alerts/layout.tsx` (the sidebar already labels location). Per-tab helper text
  moves into the empty-state / a small inline hint.
- Card grids are unchanged.

### 4. Profile — active alerts stat

- **API** (`app/api/profile/stats/route.ts`): add an `activeAlerts` count —
  `saved_searches` where `user_id = user.id` and `paused = false`
  (`count: 'exact', head: true`), returned alongside the existing fields.
- **UI** (`ProfileDashboard.tsx`): add a 4th `StatCard` ("Active alerts") to
  `StatsStrip`; adjust the grid from `grid-cols-3` to a 4-up layout that wraps
  gracefully on small screens.

## Components / files touched

**New**
- `app/components/shell/AppShell.tsx`
- `app/components/shell/AppSidebar.tsx`
- `app/components/shell/nav-hooks.ts` (extracted hooks + `markIntentionalSignOut`)

**Modified**
- `app/(protected)/layout.tsx` — mount `AppShell` around `{children}`.
- `app/(protected)/alerts/layout.tsx` — drop nav + shrink/remove header.
- `app/(protected)/saves/layout.tsx` — drop nav.
- `app/(protected)/watchlist/layout.tsx` — drop nav.
- `app/(protected)/search/page.tsx` — remove inline nav/AuthButton.
- `app/(protected)/profile/page.tsx` — remove inline nav/AuthButton.
- `app/(protected)/settings/page.tsx` — remove inline nav/AuthButton; update
  `markIntentionalSignOut` import to its new module.
- `app/(protected)/search-history/page.tsx` — remove inline nav/AuthButton.
- `app/components/alerts/AlertsTabsClient.tsx` — unified toolbar + pill tabs.
- `app/components/profile/WatchlistTab.tsx` — toolbar/status/banner adjustments.
- `app/components/alerts/SearchAlertsTab.tsx` — toolbar integration.
- `app/api/profile/stats/route.ts` — add `activeAlerts`.
- `app/components/profile/ProfileDashboard.tsx` — 4th stat tile.

**Deleted**
- `app/components/AuthButton.tsx` (after migration).

## Testing / success criteria

- `npx tsc --noEmit` clean.
- Every protected page renders exactly one shell (no double nav, no leftover
  top bars). Active nav item is highlighted correctly per route.
- Sidebar expand/retract persists across reloads; collapsed rail shows tooltips.
- Mobile (`< lg`): hamburger opens the drawer; nav + unread badge work; Escape /
  backdrop close it; no horizontal page scroll.
- Alerts unread badge still lights up and clears on visiting `/alerts`
  (realtime path preserved).
- Upgrade pill still appears only for free plan; avatar menu items and sign-out
  work; "session expired" toast still suppressed on intentional sign-out
  (including from settings).
- Alerts page: pill tabs with counts, contextual controls, single status line,
  slim refresh banner; no leftover description strip or redundant count rows.
- Profile: 4 stat tiles including a correct "Active alerts" count.
- Light + dark mode correct; no console errors; ports 3000/8000 freed after dev.

## Docs to update after implementation

- `HANDOFF.md` — "Current state" (new app shell) + "Recent changes" bullet.
- `docs/SYSTEM_DESIGN.md` — note the shared protected shell / sidebar if the
  navigation architecture is described there.
- `docs/PITFALLS.md` — if any gotcha surfaces (e.g. content offset, drawer focus
  trap, realtime badge after refactor).
