# Knosi P0 Launch Prep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all P0 blockers before public launch: marketing landing page, sidebar reorganization with feature flags, AGPL-3.0 license, brand rename from "Second Brain" to "Knosi", and dashboard Token→Knowledge card.

**Architecture:** Five independent workstreams: (1) Marketing landing page at `/` for unauthenticated visitors, (2) Sidebar narrative grouping + feature flags, (3) AGPL-3.0 license + README update, (4) Brand rename (app name, metadata, AppBrand component), (5) Dashboard Token→Knowledge card. Each can be committed independently.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, tRPC, Lucide icons.

---

## File Structure

### New files
- `src/app/(marketing)/layout.tsx` — minimal layout for marketing pages (no sidebar)
- `src/app/(marketing)/page.tsx` — landing page (server component with session check → redirect)
- `src/app/(marketing)/landing-page.tsx` — client component for landing page UI
- `src/lib/feature-flags.ts` — centralized feature flag definitions
- `LICENSE` — AGPL-3.0 license text

### Modified files
- `src/app/(app)/page.tsx` — remove the redirect-to-login logic (handled by layout)
- `src/app/(app)/layout.tsx` — add session redirect to login
- `src/app/layout.tsx` — update metadata title/description to Knosi
- `src/components/layout/app-brand.tsx` — rename "Second Brain" → "Knosi"
- `src/components/layout/navigation.ts` — reorganize into narrative groups with feature flag gating
- `src/components/layout/sidebar.tsx` — render grouped navigation with section headers
- `src/components/dashboard/dashboard-page-client.tsx` — add Token→Knowledge card at top
- `.env.example` — add new feature flag env vars
- `README.md` — update project name, add license section
- `package.json` — rename to "knosi"

---

## Task 1: AGPL-3.0 License

**Files:**
- Create: `LICENSE`
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Create LICENSE file**

Create `LICENSE` at project root with the full AGPL-3.0 text. Use the standard text from https://www.gnu.org/licenses/agpl-3.0.txt.

```bash
curl -sL https://www.gnu.org/licenses/agpl-3.0.txt -o LICENSE
```

- [ ] **Step 2: Update package.json name and license**

In `package.json`, change:
```json
"name": "knosi",
"license": "AGPL-3.0-or-later",
```

- [ ] **Step 3: Add license section to README.md**

Append before the last section of README.md:
```markdown
## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

For commercial licensing inquiries, contact: [your email]
```

- [ ] **Step 4: Commit**

```bash
git add LICENSE package.json README.md
git commit -m "chore: add AGPL-3.0 license and rename to Knosi"
```

---

## Task 2: Brand Rename — "Second Brain" → "Knosi"

**Files:**
- Modify: `src/app/layout.tsx` (metadata)
- Modify: `src/components/layout/app-brand.tsx` (brand text)
- Modify: `src/app/login/page.tsx` (login page title)
- Modify: `src/app/register/page.tsx` (if it shows "Second Brain")

- [ ] **Step 1: Update root layout metadata**

In `src/app/layout.tsx`, change metadata:
```typescript
export const metadata: Metadata = {
  title: "Knosi",
  description: "Turn your Claude tokens into a second brain you actually own.",
  applicationName: "Knosi",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Knosi",
  },
};
```

- [ ] **Step 2: Update AppBrand component**

In `src/components/layout/app-brand.tsx`, change the brand text:
```tsx
<div className="truncate text-[13px] font-semibold text-stone-900 dark:text-stone-100">
  Knosi
</div>
```

- [ ] **Step 3: Update login page title**

In `src/app/login/page.tsx`, change:
```tsx
<h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
  Knosi
</h1>
<p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
  Sign in to your knowledge base
</p>
```

- [ ] **Step 4: Check and update register page**

Read `src/app/register/page.tsx` — if it references "Second Brain", update to "Knosi".

- [ ] **Step 5: Update manifest if needed**

Check `public/manifest.webmanifest` — update `name` and `short_name` to "Knosi".

- [ ] **Step 6: Build check**

```bash
pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: rebrand Second Brain → Knosi across app"
```

---

## Task 3: Feature Flags System

**Files:**
- Create: `src/lib/feature-flags.ts`
- Modify: `.env.example`

- [ ] **Step 1: Create feature flags module**

Create `src/lib/feature-flags.ts`:

```typescript
/**
 * Centralized feature flags.
 * Server-side flags read from process.env.
 * Client-side flags read from NEXT_PUBLIC_ prefixed env vars.
 *
 * Default visibility: Notes, Ask AI, Learning (learn), Token Usage are ON.
 * Portfolio, OSS Projects, Focus Tracker are OFF by default.
 */

function envBool(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val === "true" || val === "1";
}

/** Server-side flags */
export const featureFlags = {
  tokenUsage: envBool("ENABLE_TOKEN_USAGE", false),
  portfolio: envBool("ENABLE_PORTFOLIO", false),
  ossProjects: envBool("ENABLE_OSS_PROJECTS", false),
  focusTracker: envBool("ENABLE_FOCUS_TRACKER", false),
} as const;

/**
 * Client-side flags (read NEXT_PUBLIC_ vars).
 * Call this in client components or pass from server as props.
 */
export const clientFeatureFlags = {
  tokenUsage: envBool("NEXT_PUBLIC_ENABLE_TOKEN_USAGE", false),
  portfolio: envBool("NEXT_PUBLIC_ENABLE_PORTFOLIO", false),
  ossProjects: envBool("NEXT_PUBLIC_ENABLE_OSS_PROJECTS", false),
  focusTracker: envBool("NEXT_PUBLIC_ENABLE_FOCUS_TRACKER", false),
} as const;

export type FeatureFlags = typeof featureFlags;
```

- [ ] **Step 2: Update .env.example**

Add to the feature flags section in `.env.example`:
```bash
# ── 功能开关 ──────────────────────────────────────────
ENABLE_TOKEN_USAGE=false
NEXT_PUBLIC_ENABLE_TOKEN_USAGE=false
ENABLE_PORTFOLIO=false
NEXT_PUBLIC_ENABLE_PORTFOLIO=false
ENABLE_OSS_PROJECTS=false
NEXT_PUBLIC_ENABLE_OSS_PROJECTS=false
ENABLE_FOCUS_TRACKER=false
NEXT_PUBLIC_ENABLE_FOCUS_TRACKER=false
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/feature-flags.ts .env.example
git commit -m "feat: add centralized feature flags for module visibility"
```

---

## Task 4: Sidebar Narrative Grouping

**Files:**
- Modify: `src/components/layout/navigation.ts` — restructure into grouped sections
- Modify: `src/components/layout/sidebar.tsx` — render section headers and feature-flag-gated items

- [ ] **Step 1: Restructure navigation.ts**

Rewrite `src/components/layout/navigation.ts` to export grouped navigation:

```typescript
import {
  Activity,
  BookOpen,
  FileText,
  FolderGit2,
  LayoutDashboard,
  MessageCircle,
  Timer,
  TrendingUp,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** If set, this item is only shown when the corresponding feature flag is true */
  featureFlag?: "tokenUsage" | "portfolio" | "ossProjects" | "focusTracker";
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navigationGroups: NavGroup[] = [
  {
    label: "CAPTURE",
    items: [
      { href: "/", label: "Home", icon: LayoutDashboard },
      { href: "/notes", label: "Notes", icon: FileText },
      { href: "/ask", label: "Ask AI", icon: MessageCircle },
    ],
  },
  {
    label: "LEARN",
    items: [
      { href: "/learn", label: "Learning", icon: BookOpen },
      { href: "/projects", label: "Projects", icon: FolderGit2, featureFlag: "ossProjects" },
    ],
  },
  {
    label: "TRACK",
    items: [
      { href: "/portfolio", label: "Portfolio", icon: TrendingUp, featureFlag: "portfolio" },
      { href: "/focus", label: "Focus", icon: Timer, featureFlag: "focusTracker" },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { href: "/usage", label: "Usage", icon: Activity, featureFlag: "tokenUsage" },
    ],
  },
];

/** Flat list for backwards compat (mobile nav, etc.) */
export const navigationItems = navigationGroups.flatMap((g) => g.items);
```

- [ ] **Step 2: Update sidebar.tsx to render groups**

Modify `src/components/layout/sidebar.tsx`:

1. Import `navigationGroups` instead of `navigationItems`, and import `clientFeatureFlags` from `@/lib/feature-flags`.
2. Replace the flat `navigationItems.map(...)` with grouped rendering:

```tsx
import { navigationGroups, type NavItem } from "./navigation";
import { clientFeatureFlags } from "@/lib/feature-flags";

// Inside the Sidebar component, replace the <nav> section:
<nav className="flex-1 space-y-3 overflow-y-auto px-2 pt-1">
  {navigationGroups.map((group) => {
    const visibleItems = group.items.filter(
      (item) => !item.featureFlag || clientFeatureFlags[item.featureFlag]
    );
    if (visibleItems.length === 0) return null;

    return (
      <div key={group.label}>
        {!collapsed && (
          <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500">
            {group.label}
          </div>
        )}
        <div className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center rounded-lg text-[13px] font-medium transition-colors",
                  collapsed ? "h-9 justify-center" : "gap-2.5 px-3 py-2",
                  isActive
                    ? "bg-stone-200/70 text-stone-900 dark:bg-stone-800/80 dark:text-stone-100"
                    : "text-stone-600 hover:bg-stone-200/50 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800/60 dark:hover:text-stone-100"
                )}
              >
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-stone-900 dark:bg-stone-100" />
                )}
                <Icon
                  className={cn(
                    "h-[16px] w-[16px] shrink-0",
                    isActive ? "text-stone-900 dark:text-stone-100" : ""
                  )}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </div>
    );
  })}
</nav>
```

- [ ] **Step 3: Update mobile-nav if it imports navigationItems**

Check `src/components/layout/mobile-nav.tsx` — it likely imports `navigationItems`. The flat list export in navigation.ts ensures backward compat, but verify mobile-nav still renders correctly. If mobile-nav should also show groups, update it similarly.

- [ ] **Step 4: Build check**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/navigation.ts src/components/layout/sidebar.tsx src/components/layout/mobile-nav.tsx
git commit -m "feat: sidebar narrative grouping with feature flag gating"
```

---

## Task 5: Marketing Landing Page

**Files:**
- Create: `src/app/(marketing)/layout.tsx`
- Create: `src/app/(marketing)/page.tsx`
- Create: `src/app/(marketing)/landing-page.tsx`
- Modify: `src/app/(app)/page.tsx` — remove redirect-to-login (now handled by marketing route)
- Modify: `src/app/(app)/layout.tsx` — add session guard with redirect to `/login`

This is the most complex task. The key routing change:
- **Unauthenticated users** hitting `/` see the marketing landing page `(marketing)/page.tsx`
- **Authenticated users** hitting `/` see the dashboard `(app)/page.tsx`
- The `(marketing)/page.tsx` checks session: if logged in → redirect to dashboard at `/dashboard`; if not → show landing page
- The `(app)` route group moves its dashboard from `/` to `/dashboard`

**Wait — simpler approach:** Keep `(app)/page.tsx` as the dashboard. Make the root `/` route in `(marketing)` check session and either redirect to `(app)` or show landing. But Next.js can't have two route groups both claiming `/`.

**Actual approach:** Use a single root `page.tsx` at `src/app/page.tsx` that checks auth and conditionally renders. Move current dashboard to `src/app/(app)/dashboard/page.tsx`. Root `/` for visitors, `/dashboard` for authenticated users.

**Revised approach (simplest):** Move current `(app)/page.tsx` (dashboard) to `(app)/dashboard/page.tsx`. Create a new top-level `src/app/page.tsx` that checks session → redirect to `/dashboard` if logged in, otherwise render the landing page inline.

- [ ] **Step 1: Move dashboard to /dashboard route**

Move `src/app/(app)/page.tsx` to `src/app/(app)/dashboard/page.tsx`. This means authenticated users access dashboard at `/dashboard`.

Update the dashboard page — no code changes needed since it's a server component that fetches its own data.

- [ ] **Step 2: Update internal links pointing to `/`**

Search for links that point to `href="/"` and should point to `/dashboard` instead:

```bash
# Find all references to href="/" in components
grep -rn 'href="/"' src/components/ src/app/
```

Key files to update:
- `src/components/layout/navigation.ts` — Home href changes to `/dashboard`
- `src/app/login/page.tsx` — redirect after login → `/dashboard`
- `src/components/layout/app-brand.tsx` — if it links to `/`, change to `/dashboard`
- Any `redirect("/")` calls → `redirect("/dashboard")`
- Auth callback redirectTo → `/dashboard`

Update each occurrence:

In `navigation.ts`:
```typescript
{ href: "/dashboard", label: "Home", icon: LayoutDashboard },
```

In `login/page.tsx`, change:
```typescript
if (session) {
  redirect("/dashboard");
}
```

And the OAuth forms:
```typescript
await signIn("github", { redirectTo: "/dashboard" });
await signIn("google", { redirectTo: "/dashboard" });
```

In `src/app/(app)/layout.tsx` — no changes needed (it's a route group layout).

Search and update any other `redirect("/")` in server actions.

- [ ] **Step 3: Create landing page at src/app/page.tsx**

Create `src/app/page.tsx` — a server component that checks session:

```tsx
import { redirect } from "next/navigation";
import { getRequestSession } from "@/server/auth/request-session";
import { LandingPage } from "@/components/marketing/landing-page";

export default async function RootPage() {
  const session = await getRequestSession();
  if (session) {
    redirect("/dashboard");
  }
  return <LandingPage />;
}
```

- [ ] **Step 4: Create landing page component**

Create `src/components/marketing/landing-page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { BrainCircuit, Zap, BookOpen, Search, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Token → Knowledge",
    description:
      "Every AI conversation becomes a permanent note. Your $20/mo subscription stops evaporating.",
  },
  {
    icon: BookOpen,
    title: "Learning Notebooks",
    description:
      "AI-generated outlines, blind-spot analysis, and review questions. Not just storage — comprehension.",
  },
  {
    icon: Search,
    title: "Hybrid RAG Search",
    description:
      "Semantic + keyword search across all your notes. Ask questions, get answers with source citations.",
  },
  {
    icon: BarChart3,
    title: "Token Usage Dashboard",
    description:
      'Track how much of your Claude subscription actually becomes knowledge. See your "conversion rate."',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-stone-900">
            <BrainCircuit className="h-4 w-4" strokeWidth={2} />
          </div>
          <span className="text-sm font-semibold tracking-tight">Knosi</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="https://github.com/user/knosi"
            className="text-sm text-stone-400 transition-colors hover:text-white"
          >
            GitHub
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-white px-3.5 py-1.5 text-sm font-medium text-stone-900 transition-colors hover:bg-stone-200"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-24 pb-20 text-center">
        <div className="mb-6 inline-block rounded-full border border-stone-800 px-3 py-1 text-xs text-stone-400">
          Open source · AGPL-3.0
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Your Claude Max runs out.
          <br />
          <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
            Your notes don&apos;t.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-stone-400">
          Turn every valuable AI conversation into a knowledge base you own
          forever. Self-hosted, open-source.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-stone-900 transition-colors hover:bg-stone-200"
          >
            Try the live demo
          </Link>
          <Link
            href="https://github.com/user/knosi"
            className="rounded-lg border border-stone-700 px-5 py-2.5 text-sm font-semibold text-stone-300 transition-colors hover:border-stone-500 hover:text-white"
          >
            Star on GitHub
          </Link>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl border border-stone-800 bg-stone-900/50 p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
            The problem
          </h2>
          <p className="mt-4 text-xl font-medium leading-relaxed text-stone-200">
            You pay $20–200/month for Claude. Every brilliant insight, every
            solved problem, every learning moment — gone the moment you close
            the tab. Your tokens are{" "}
            <span className="text-red-400">consumed</span>, not{" "}
            <span className="text-cyan-300">converted</span>.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="mb-10 text-center text-sm font-semibold uppercase tracking-wider text-stone-500">
          The solution
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-stone-800 bg-stone-900/40 p-6"
            >
              <f.icon className="mb-3 h-5 w-5 text-cyan-400" strokeWidth={1.8} />
              <h3 className="text-base font-semibold text-stone-100">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-400">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-stone-500">
          Built with
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-stone-500">
          {[
            "Next.js 16",
            "React 19",
            "Tailwind CSS v4",
            "tRPC v11",
            "SQLite / Turso",
            "Drizzle ORM",
            "Vercel AI SDK",
            "Tiptap v3",
          ].map((t) => (
            <span
              key={t}
              className="rounded-md border border-stone-800 px-2.5 py-1"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-24 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Stop losing your best thinking.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-stone-400">
          Every Claude conversation is an investment. Knosi makes sure it compounds.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-stone-900 transition-colors hover:bg-stone-200"
          >
            Get started
          </Link>
          <Link
            href="https://github.com/user/knosi"
            className="rounded-lg border border-stone-700 px-5 py-2.5 text-sm font-semibold text-stone-300 transition-colors hover:border-stone-500 hover:text-white"
          >
            View source
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-800 py-8 text-center text-xs text-stone-600">
        Knosi · AGPL-3.0 · Made by{" "}
        <Link href="https://x.com/user" className="text-stone-400 hover:text-white">
          @knosi
        </Link>
      </footer>
    </div>
  );
}
```

- [ ] **Step 5: Add session guard to (app) layout**

In `src/app/(app)/layout.tsx`, add redirect for unauthenticated users so they can't access any app route without login:

```typescript
// At the top of AppLayout, after getting session:
const session = await getRequestSession();
if (!session) {
  redirect("/login");
}
```

And remove the session/redirect logic from `src/app/(app)/dashboard/page.tsx` since the layout now handles it.

- [ ] **Step 6: Build check**

```bash
pnpm build
```

- [ ] **Step 7: Manual browser test**

1. Visit `http://localhost:3200/` while logged out → should see landing page
2. Click "Sign in" → goes to `/login`
3. Log in → redirected to `/dashboard`
4. Visit `http://localhost:3200/` while logged in → redirected to `/dashboard`
5. Sidebar "Home" link goes to `/dashboard`

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx src/app/(app)/dashboard/ src/components/marketing/ src/app/(app)/layout.tsx
git commit -m "feat: marketing landing page for unauthenticated visitors"
```

---

## Task 6: Dashboard Token→Knowledge Card

**Files:**
- Modify: `src/components/dashboard/dashboard-page-client.tsx` — add Token→Knowledge summary card at top
- Modify: `src/server/routers/dashboard.ts` — add token conversion stats to dashboard.stats query

- [ ] **Step 1: Check existing dashboard router**

Read `src/server/routers/dashboard.ts` to understand the current stats query shape.

- [ ] **Step 2: Extend dashboard stats with token data**

In the dashboard router, add fields to the stats response:

```typescript
// Add to the stats query result:
tokenStats: {
  monthlyTokens: number;       // total tokens used this month
  notesCreatedThisMonth: number; // notes created this month
  conversionRate: number;       // rough metric: notes / (tokens / 1000)
}
```

Query the `tokenUsageEntries` table (if it exists and ENABLE_TOKEN_USAGE is true) for this month's total. Query notes created this month. Calculate a simple conversion metric.

If token usage is disabled, return null for tokenStats so the card hides gracefully.

- [ ] **Step 3: Add Token→Knowledge card to dashboard**

In `src/components/dashboard/dashboard-page-client.tsx`, add a card at the top of the page (above the focus tracking card):

```tsx
{/* Token → Knowledge */}
{data?.tokenStats && (
  <section className="rounded-md border border-stone-200 bg-white/70 p-4 dark:border-stone-800 dark:bg-stone-950/50">
    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500">
      Token → Knowledge
    </div>
    <div className="mt-3 grid grid-cols-3 gap-4">
      <div>
        <div className="text-xl font-semibold tabular-nums text-stone-900 dark:text-stone-50">
          {(data.tokenStats.monthlyTokens / 1000).toFixed(0)}k
        </div>
        <div className="mt-0.5 text-[11px] text-stone-400">tokens this month</div>
      </div>
      <div>
        <div className="text-xl font-semibold tabular-nums text-stone-900 dark:text-stone-50">
          {data.tokenStats.notesCreatedThisMonth}
        </div>
        <div className="mt-0.5 text-[11px] text-stone-400">notes created</div>
      </div>
      <div>
        <div className="text-xl font-semibold tabular-nums text-cyan-600 dark:text-cyan-400">
          {data.tokenStats.conversionRate.toFixed(1)}%
        </div>
        <div className="mt-0.5 text-[11px] text-stone-400">conversion rate</div>
      </div>
    </div>
  </section>
)}
```

- [ ] **Step 4: Build check**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/dashboard-page-client.tsx src/server/routers/dashboard.ts
git commit -m "feat: Token→Knowledge dashboard card"
```

---

## Task 7: Update local .env for development

**Files:**
- Modify: `.env.local` (or `.env`)

- [ ] **Step 1: Enable all feature flags for local dev**

Add to `.env.local`:
```bash
ENABLE_TOKEN_USAGE=true
NEXT_PUBLIC_ENABLE_TOKEN_USAGE=true
ENABLE_PORTFOLIO=true
NEXT_PUBLIC_ENABLE_PORTFOLIO=true
ENABLE_OSS_PROJECTS=true
NEXT_PUBLIC_ENABLE_OSS_PROJECTS=true
ENABLE_FOCUS_TRACKER=true
NEXT_PUBLIC_ENABLE_FOCUS_TRACKER=true
```

- [ ] **Step 2: Verify sidebar shows all modules in dev**

```bash
pnpm dev
```

Visit `http://localhost:3200/dashboard` — all sidebar groups should be visible.

- [ ] **Step 3: Commit .env.example only (not .env.local)**

```bash
git add .env.example
git commit -m "docs: document all feature flag env vars"
```

---

## Task 8: Final integration build + lint

**Files:** (no code changes)

- [ ] **Step 1: Full build**

```bash
pnpm build
```

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build/lint issues from P0 launch prep"
```

- [ ] **Step 5: Push**

```bash
git push
```

---

## Task 9: Pre-merge verification

**Files:** (no code changes)

- [ ] **Step 1: Browser smoke test**

Verify all core flows work:
1. Landing page renders at `/` (logged out)
2. Login flow → redirects to `/dashboard`
3. Dashboard shows Token→Knowledge card (if token usage enabled)
4. Sidebar shows grouped navigation with correct section headers
5. Feature flags correctly hide/show modules
6. Brand shows "Knosi" everywhere
7. Dark mode works on landing page and app

- [ ] **Step 2: Check for broken links**

Click through all sidebar nav items to ensure no 404s after the route reorganization.

- [ ] **Step 3: Mobile responsive check**

Check landing page and dashboard at 375px width.

---

## Task 10: Post-merge changelog

**Files:**
- Create: `docs/changelog/2026-04-12-knosi-p0-launch-prep.md`

- [ ] **Step 1: Write changelog entry**

Document all changes made, verification results, and any remaining P1 items.

- [ ] **Step 2: Commit changelog**

```bash
git add docs/changelog/2026-04-12-knosi-p0-launch-prep.md
git commit -m "docs: P0 launch prep changelog"
git push
```
