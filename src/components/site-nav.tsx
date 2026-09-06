import { Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roleHome, roleLabels, useAuth } from "@/lib/auth";

export function SiteNav() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <span className="text-base font-bold tracking-tight">
            CrowdGuard<span className="text-accent"> Bauchi</span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#venues" className="transition-colors hover:text-foreground">
            Venues
          </a>
          <a href="#roles" className="transition-colors hover:text-foreground">
            Roles
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
        </div>

        <div className="flex items-center gap-2">
          {user && role ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: roleHome[role] })}>
                {roleLabels[role]} dashboard
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/", replace: true });
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth" search={{ mode: "login" }}>
                  Sign in
                </Link>
              </Button>
              <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/auth" search={{ mode: "register" }}>
                  Get started
                </Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
