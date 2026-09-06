import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarCheck,
  QrCode,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { HeroSlider } from "@/components/hero-slider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CrowdGuard Bauchi — Event Centre & Crowd Control" },
      {
        name: "description",
        content:
          "Manage venues, events, QR tickets and real-time crowd occupancy across Bauchi State event centres from one secure platform.",
      },
      { property: "og:title", content: "CrowdGuard Bauchi — Event Centre & Crowd Control" },
      {
        property: "og:description",
        content:
          "Venue capacity, QR ticket validation, live occupancy tracking and incident reporting for Bauchi State events.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Building2,
    title: "Venue management",
    body: "Register event centres with verified capacity and warning thresholds that drive every safety decision.",
  },
  {
    icon: CalendarCheck,
    title: "Event lifecycle",
    body: "Draft, publish, run and close events with registrations and attendance tracked end to end.",
  },
  {
    icon: QrCode,
    title: "QR ticketing",
    body: "Every registration issues a unique QR ticket that is validated once, at the gate, in seconds.",
  },
  {
    icon: Activity,
    title: "Live occupancy",
    body: "Normal, Warning, Near Capacity and Critical states update the moment someone enters or exits.",
  },
  {
    icon: AlertTriangle,
    title: "Incidents & alerts",
    body: "Officers file incidents with priority; administrators triage from Pending to Resolved.",
  },
  {
    icon: BarChart3,
    title: "Reports",
    body: "Export-ready summaries of events, attendance, incidents and crowd performance.",
  },
];

const roles = [
  { icon: ShieldCheck, name: "Administrator", body: "Users, roles, venues, officers, alerts, incidents and reports." },
  { icon: CalendarCheck, name: "Organizer", body: "Create and publish events, watch registrations and attendance." },
  { icon: Users, name: "Attendee", body: "Browse events, register, and carry a digital QR ticket." },
  { icon: QrCode, name: "Security Officer", body: "Scan entry and exit, control capacity, report incidents." },
];

const steps = [
  { n: "01", t: "Scan the QR", d: "The officer scans the attendee's ticket at the assigned gate or zone." },
  { n: "02", t: "Validate", d: "The system checks the ticket exists, is unused, and the venue has room." },
  { n: "03", t: "Approve or reject", d: "Entry is allowed and counted, or rejected as invalid, duplicate or full." },
  { n: "04", t: "Track live", d: "Occupancy rises on entry, falls on exit, and dashboards refresh instantly." },
];

function Landing() {
  const { data: venues } = useQuery({
    queryKey: ["public-venues"],
    queryFn: async () => {
      const { data } = await supabase
        .from("venues")
        .select("id, name, address, capacity, description")
        .order("capacity", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <HeroSlider />

      <main>
        <section id="features" className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Capabilities</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold sm:text-4xl">
            Everything an event centre needs, in one operating system
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="border-border/60 transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="venues" className="bg-secondary/60 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Bauchi State</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Venues on the platform</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {(venues ?? []).slice(0, 6).map((v) => (
                <Card key={v.id} className="border-border/60 bg-card">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold">{v.name}</h3>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{v.address}</p>
                    <p className="mt-3 text-sm text-muted-foreground">{v.description}</p>
                    <p className="mt-4 text-sm font-semibold text-primary">
                      Capacity: {v.capacity.toLocaleString()} guests
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="roles" className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Role-based access</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Each person sees exactly their job</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((r) => (
              <div key={r.name} className="rounded-xl border border-border/60 bg-card p-6">
                <r.icon className="size-6 text-accent" />
                <h3 className="mt-4 font-semibold">{r.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="bg-primary py-20 text-primary-foreground">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Entry flow</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">From QR scan to live occupancy</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-4">
              {steps.map((s) => (
                <div key={s.n}>
                  <span className="text-4xl font-bold text-accent/70">{s.n}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                  <p className="mt-2 text-sm text-primary-foreground/70">{s.d}</p>
                </div>
              ))}
            </div>
            <div className="mt-12">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/auth" search={{ mode: "register" }}>
                  Get started free
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row">
          <p>CrowdGuard Bauchi — Event Centre Management & Real-Time Crowd Control</p>
          <p>Bauchi State, Nigeria</p>
        </div>
      </footer>
    </div>
  );
}
