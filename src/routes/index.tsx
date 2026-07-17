import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Database,
  History,
  GitBranch,
  Zap,
  Lock,
  ArrowRight,
  Server,
  PackageCheck,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, oklch(0.85 0.14 190 / 40%), transparent)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Nav */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="text-sm font-semibold tracking-tight">Imam Recovery OS</span>
          <span className="mono ml-2 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            for Shopify
          </span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#platform" className="hidden hover:text-foreground sm:inline">Platform</a>
          <a href="#modules" className="hidden hover:text-foreground sm:inline">Modules</a>
          <a href="#limits" className="hidden hover:text-foreground sm:inline">Limits</a>
          <Link
            to="/auth"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition hover:bg-elevated"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-24 text-center">
        <div className="mono mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-primary" />
          Enterprise Disaster Recovery
        </div>
        <h1 className="mt-8 text-balance text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
          <span className="text-gradient-accent">Time Machine</span>
          <br />
          <span className="text-foreground">for Shopify.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          Connect your store, press one button, and take a portable snapshot of every recoverable
          resource. If disaster strikes, restore into any Shopify store — automatically.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Open the console
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#platform"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm text-foreground transition hover:bg-elevated"
          >
            How it works
          </a>
        </div>

        {/* Console preview */}
        <div className="surface-panel mx-auto mt-16 max-w-4xl overflow-hidden text-left">
          <div className="flex items-center justify-between border-b border-border bg-surface/40 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
            </div>
            <div className="mono text-[11px] text-muted-foreground">
              imam-recovery-os / atlas-supply.myshopify.com
            </div>
            <div className="mono flex items-center gap-1.5 text-[11px] text-success">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-success" />
              ONLINE
            </div>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-3">
            {[
              { k: "Recovery score", v: "97", suffix: "/100", accent: true },
              { k: "Last snapshot", v: "12m", suffix: "ago" },
              { k: "Package size", v: "184", suffix: "MB" },
            ].map((c) => (
              <div key={c.k} className="bg-card p-5">
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {c.k}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span
                    className={`mono text-3xl font-semibold ${c.accent ? "text-gradient-accent" : "text-foreground"}`}
                  >
                    {c.v}
                  </span>
                  <span className="mono text-sm text-muted-foreground">{c.suffix}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 p-5">
            {[
              ["Products", "1,284", "success"],
              ["Collections", "62", "success"],
              ["Pages & articles", "148", "success"],
              ["Theme + assets", "412 files", "success"],
              ["Customers", "8,904", "success"],
              ["Historical orders", "recover metadata only", "warning"],
              ["Payment providers", "manual reconnect", "info"],
            ].map(([k, v, tone]) => (
              <div
                key={k}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-elevated/50"
              >
                <span className="text-foreground/90">{k}</span>
                <span
                  className={`mono text-xs ${
                    tone === "warning"
                      ? "text-warning"
                      : tone === "info"
                        ? "text-info"
                        : "text-success"
                  }`}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-7xl px-6 py-20">
        <SectionTag>Modules</SectionTag>
        <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight">
          An operating system, not a backup script.
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {[
            [Database, "Complete Scanner", "Discovers every recoverable resource — products, themes, metafields, metaobjects, files, translations, redirects, and more."],
            [PackageCheck, "Portable Packages", "Signed .recovery archives with manifest, checksums, dependency graph, and per-resource integrity hashes."],
            [History, "Versioned Snapshots", "Every backup is a snapshot. Diff two versions, roll back a single resource, or restore in full."],
            [GitBranch, "Restore Engine", "Analyze compatibility, generate a restore plan, and replay resources in dependency order into any Shopify store."],
            [Activity, "Recovery Score", "A 0–100 confidence score. See exactly what would recover automatically and what needs manual action."],
            [Zap, "AI Recovery Assistant", "Explains failures, recommends restore order, and turns raw logs into human-readable reports."],
          ].map(([Icon, title, body]) => (
            <div key={title as string} className="group bg-card p-6 transition hover:bg-elevated">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-primary">
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <h3 className="mt-5 text-base font-semibold tracking-tight">{title as string}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {body as string}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Platform */}
      <section id="platform" className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-16 lg:grid-cols-2">
          <div>
            <SectionTag>Pipeline</SectionTag>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              Eight-stage export engine.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Deterministic stages, retry on failure, resumable at any point. Every stage emits
              structured logs and integrity metadata.
            </p>
          </div>
          <ol className="space-y-2">
            {[
              "Authenticate & verify scopes",
              "Discover recoverable resources",
              "Map dependencies & references",
              "Download resource payloads",
              "Rebuild relationship graph",
              "Validate integrity & checksums",
              "Compress into .recovery archive",
              "Publish signed recovery package",
            ].map((step, i) => (
              <li
                key={step}
                className="surface-panel flex items-center gap-4 px-4 py-3"
              >
                <span className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-elevated text-xs text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-foreground/90">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Limits */}
      <section id="limits" className="mx-auto max-w-7xl px-6 py-20">
        <SectionTag>Honest by design</SectionTag>
        <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">
          What restores automatically — and what doesn't.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <LimitCard
            tone="success"
            title="Fully recoverable"
            items={[
              "Products & variants",
              "Collections",
              "Customers",
              "Pages, blogs & articles",
              "Navigation menus",
              "Themes, sections, snippets",
              "Metafields & metaobjects",
              "Files, inventory, redirects",
              "Translations & markets",
            ]}
          />
          <LimitCard
            tone="warning"
            title="Recoverable with limits"
            items={[
              "Historical orders (metadata)",
              "Draft orders",
              "Gift card metadata",
              "Customer event timelines",
              "Some fulfillment records",
            ]}
          />
          <LimitCard
            tone="info"
            title="Manual reconnect required"
            items={[
              "Shopify Payments / Stripe / PayPal",
              "Custom domains & DNS",
              "Meta Pixel ownership",
              "Google Merchant / Analytics",
              "Email SPF/DKIM/DMARC",
              "Third-party app subscriptions",
              "External ERPs, CRMs, WMS",
            ]}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="surface-panel relative overflow-hidden p-10 text-center">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              background:
                "radial-gradient(600px circle at 50% -20%, var(--accent), transparent 60%)",
            }}
          />
          <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">
            Sleep better. Ship faster.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Every Shopify store deserves an escape hatch. Connect yours in under a minute.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Start free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl items-center justify-between border-t border-border px-6 py-8 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <LogoMark small />
          <span className="mono">imam-recovery-os · v0.1</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="mono flex items-center gap-1.5">
            <Lock className="h-3 w-3" /> Tokens encrypted at rest
          </span>
          <span className="mono hidden sm:inline">
            <Server className="mr-1 inline h-3 w-3" /> Powered by Lovable Cloud
          </span>
        </div>
      </footer>
    </div>
  );
}

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-primary">
      <span className="h-px w-6 bg-primary/50" />
      {children}
    </div>
  );
}

function LimitCard({
  tone,
  title,
  items,
}: {
  tone: "success" | "warning" | "info";
  title: string;
  items: string[];
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-info";
  return (
    <div className="surface-panel p-6">
      <div className={`mono text-[11px] uppercase tracking-widest ${toneClass}`}>{title}</div>
      <ul className="mt-4 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2 text-foreground/90">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current ${toneClass}`} />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LogoMark({ small = false }: { small?: boolean }) {
  const size = small ? 16 : 22;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="text-primary"
      aria-hidden
    >
      <path
        d="M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6l-9-4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 12.5l2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
