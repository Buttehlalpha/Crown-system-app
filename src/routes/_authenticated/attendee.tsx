import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Ticket as TicketIcon, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { crowdStatus, toneClasses } from "@/lib/crowd";
import { DashboardShell } from "@/components/dashboard/shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { TicketCard, type TicketRow } from "@/components/dashboard/ticket-card";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/attendee")({
  head: () => ({
    meta: [
      { title: "Attendee dashboard — CrowdGuard Bauchi" },
      { name: "description", content: "Browse Bauchi events, register and carry your digital QR ticket." },
      { property: "og:title", content: "Attendee dashboard — CrowdGuard Bauchi" },
      { property: "og:description", content: "Register for events and manage your digital QR tickets." },
    ],
  }),
  component: AttendeeDashboard,
});

function AttendeeDashboard() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  useRealtimeInvalidate(["events", "tickets"], ["attendee-events", "my-tickets"], "attendee");

  const { data: events = [] } = useQuery({
    queryKey: ["attendee-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*, venue:venues(name, address, warning_threshold)")
        .in("status", ["published", "active"])
        .order("starts_at");
      return data ?? [];
    },
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id, qr_code, status, created_at, event:events(id, title, starts_at, venue:venues(name, address))")
        .eq("attendee_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as TicketRow[];
    },
  });

  const register = async (eventId: string, capacity: number, occupancy: number) => {
    if (!user) return;
    if (tickets.some((t) => t.event?.id === eventId)) {
      toast.error("You already have a ticket for this event");
      return;
    }
    const { count } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if ((count ?? 0) >= capacity) {
      toast.error("This event is fully booked");
      return;
    }
    if (occupancy >= capacity) {
      toast.error("This venue is currently at full capacity");
      return;
    }
    const code = `ECMS-${crypto.randomUUID().toUpperCase()}`;
    const { error } = await supabase.from("tickets").insert({
      event_id: eventId,
      attendee_id: user.id,
      qr_code: code,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Registration validated — your QR ticket is ready");
    void qc.invalidateQueries({ queryKey: ["my-tickets"] });
  };

  return (
    <DashboardShell
      title={`Hello, ${profile?.full_name?.split(" ")[0] ?? "there"}`}
      description="Browse events across Bauchi State, register and carry your digital ticket."
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarDays} label="Events available" value={events.length} />
        <StatCard icon={TicketIcon} label="My tickets" value={tickets.length} />
        <StatCard
          icon={Users}
          label="Used tickets"
          value={tickets.filter((t) => t.status === "used").length}
          hint="Already scanned at a gate"
        />
      </div>

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse events</TabsTrigger>
          <TabsTrigger value="tickets">My tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {!events.length && <p className="text-sm text-muted-foreground">No published events yet.</p>}
          {events.map((e) => {
            const venue = Array.isArray(e.venue) ? e.venue[0] : e.venue;
            const status = crowdStatus(e.current_occupancy, e.capacity, venue?.warning_threshold ?? 80);
            const registered = tickets.some((t) => t.event?.id === e.id);
            return (
              <Card key={e.id} className="flex flex-col border-border/60">
                <CardContent className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{e.title}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClasses[status.tone]}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{e.description}</p>
                  <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="size-4" /> {new Date(e.starts_at).toLocaleString()}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4" /> {venue?.name}
                    </p>
                    <p className="flex items-center gap-2">
                      <Users className="size-4" /> {status.available} of {e.capacity} spaces available
                    </p>
                  </div>
                  <Button
                    className="mt-5 w-full"
                    disabled={registered || status.available === 0}
                    onClick={() => void register(e.id, e.capacity, e.current_occupancy)}
                  >
                    {registered ? "Registered" : status.available === 0 ? "Fully booked" : "Register & get ticket"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="tickets" className="mt-6 grid gap-6 lg:grid-cols-2">
          {!tickets.length && <p className="text-sm text-muted-foreground">You have no tickets yet.</p>}
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} holder={profile?.full_name || profile?.email || "Attendee"} />
          ))}
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
