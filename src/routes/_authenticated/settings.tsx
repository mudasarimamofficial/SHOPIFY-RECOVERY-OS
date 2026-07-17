import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [email, setEmail] = useState<string>("");
  const [id, setId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "—");
      setId(data.user?.id ?? "");
    });
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Account details, encryption posture, and platform metadata."
      />
      <div className="grid gap-6 p-8 lg:grid-cols-2">
        <div className="surface-panel p-6">
          <div className="mono flex items-center gap-2 text-[11px] uppercase tracking-widest text-primary">
            <User className="h-3.5 w-3.5" /> Account
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Email" icon={<Mail className="h-3.5 w-3.5" />}>
              {email}
            </Row>
            <Row label="User ID" icon={<KeyRound className="h-3.5 w-3.5" />}>
              <span className="mono text-xs text-muted-foreground">{id}</span>
            </Row>
          </dl>
        </div>

        <div className="surface-panel p-6">
          <div className="mono text-[11px] uppercase tracking-widest text-primary">Encryption</div>
          <ul className="mt-4 space-y-2 text-sm text-foreground/85">
            <li>· Shopify Admin API tokens encrypted with AES-256-GCM</li>
            <li>· 96-bit random IV per token, 128-bit auth tag</li>
            <li>· Key derived via SHA-256 from a secret stored in Lovable Cloud</li>
            <li>· Tokens are never returned to the client</li>
          </ul>
        </div>

        <div className="surface-panel p-6 lg:col-span-2">
          <div className="mono text-[11px] uppercase tracking-widest text-primary">
            Session Management
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Sign Out</h4>
              <p className="text-sm text-muted-foreground mt-1">
                End your current session and return to the login screen.
              </p>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
