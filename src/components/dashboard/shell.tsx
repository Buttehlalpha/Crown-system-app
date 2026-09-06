import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { roleLabels, useAuth } from "@/lib/auth";

export function DashboardShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="border-b border-border/60 bg-primary text-primary-foreground">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <ShieldCheck className="size-5 text-accent" /> CrowdGuard Bauchi
          </Link>
          <div className="flex items-center gap-3">
            {role && (
              <Badge className="border-accent/40 bg-accent/15 text-accent hover:bg-accent/20">{roleLabels[role]}</Badge>
            )}
            <span className="hidden text-sm text-primary-foreground/80 sm:inline">
              {profile?.full_name || profile?.email}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10"
              onClick={async () => {
                await signOut();
                navigate({ to: "/", replace: true });
              }}
            >
              <LogOut className="mr-1 size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex gap-2">{actions}</div>
        </div>
        {children}
      </div>
    </div>
  );
}
