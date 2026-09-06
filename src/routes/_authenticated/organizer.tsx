import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarPlus, Send, Ticket, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { OccupancyCard, type LiveEvent } from "@/components/dashboard/occupancy-card";
import { EventFormDialog, type EventRow } from "@/components/dashboard/event-form";
import { ReportsPanel } from "@/components/dashboard/reports";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/organizer")({
  head: () => ({
    meta: [
      { title: "Organizer dashboard — CrowdGuard Bauchi" },
      { name: "description", content: "Create and publish events, track registrations, attendance and crowd stats." },
      { property: "og:title", content: "Organizer dashboard — CrowdGuard Bauchi" },
      { property: "og:description", content: "Event creation, registrations and live attendance for organizers." },
    ],
  }),
  component: OrganizerDashboard,
});

function OrganizerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeInvalidate(["events", "attendance", "incidents", "alerts"], ["events", "org-registrations", "incidents", "alerts"], "organizer");

  const { data: events = [] } = useQuery({
    queryKey: ["events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*, venue:venues(name, warning_threshold)")
        .eq("organizer_id", user!.id)
        .order("starts_at", { ascending: false });
      return (data ?? []).map((e) => ({ ...e, venue: Array.isArray(e.venue) ? e.venue[0] : e.venue }));
    },
  });

  const eventIds = events.map((e) => e.id);

  const { data: registrations = [] } = useQuery({
    queryKey: ["org-registrations", eventIds.join(",")],
    enabled: eventIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id, status, created_at, event_id, attendee:profiles(full_name, email)")
        .in("event_id", eventIds)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents", eventIds.join(",")],
    enabled: eventIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .in("event_id", eventIds)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const publish = async (id: string) => {
    const { error } = await supabase.from("events").update({ status: "published" }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event published — attendees can now register");
    void qc.invalidateQueries({ queryKey: ["events"] });
  };

  const setStatus = async (id: string, status: "active" | "completed") => {
    const { error } = await supabase.from("events").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["events"] });
  };

  const totalInside = events.reduce((n, e) => n + (e.current_occupancy ?? 0), 0);

  return (
    <DashboardShell
      title="Organizer dashboard"
      description="Create events, publish them, and watch registrations and attendance live."
      actions={
        user ? (
          <EventFormDialog
            organizerId={user.id}
            trigger={
              <Button>
                <CalendarPlus className="mr-2 size-4" /> Create event
              </Button>
            }
          />
        ) : undefined
      }
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarPlus} label="My events" value={events.length} />
        <StatCard icon={Ticket} label="Registrations" value={registrations.length} />
        <StatCard icon={Users} label="Currently inside" value={totalInside} />
        <StatCard icon={AlertTriangle} label="Incidents" value={incidents.length} />
      </div>

      <Tabs defaultValue="events">
        <TabsList className="flex-wrap">
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="crowd">Crowd stats</TabsTrigger>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-6">
          <Card className="border-border/60">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!events.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        No events yet — create your first one.
                      </TableCell>
                    </TableRow>
                  )}
                  {events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.title}</TableCell>
                      <TableCell>{e.venue?.name}</TableCell>
                      <TableCell>{new Date(e.starts_at).toLocaleString()}</TableCell>
                      <TableCell>{e.capacity}</TableCell>
                      <TableCell>
                        <Badge variant={e.status === "published" || e.status === "active" ? "default" : "secondary"}>
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        {user && (
                          <EventFormDialog
                            organizerId={user.id}
                            event={e as unknown as EventRow}
                            trigger={
                              <Button size="sm" variant="outline">
                                Edit
                              </Button>
                            }
                          />
                        )}
                        {e.status === "draft" && (
                          <Button size="sm" onClick={() => void publish(e.id)}>
                            <Send className="mr-1 size-3.5" /> Publish
                          </Button>
                        )}
                        {e.status === "published" && (
                          <Button size="sm" variant="secondary" onClick={() => void setStatus(e.id, "active")}>
                            Start
                          </Button>
                        )}
                        {e.status === "active" && (
                          <Button size="sm" variant="secondary" onClick={() => void setStatus(e.id, "completed")}>
                            Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crowd" className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events
            .filter((e) => e.status === "published" || e.status === "active")
            .map((e) => (
              <OccupancyCard key={e.id} event={e as unknown as LiveEvent} />
            ))}
          {!events.some((e) => e.status === "published" || e.status === "active") && (
            <p className="text-sm text-muted-foreground">No live events right now.</p>
          )}
        </TabsContent>

        <TabsContent value="registrations" className="mt-6">
          <Card className="border-border/60">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Attendee</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Ticket status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!registrations.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No registrations yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {registrations.map((r) => {
                    const p = Array.isArray(r.attendee) ? r.attendee[0] : r.attendee;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{p?.full_name || p?.email}</TableCell>
                        <TableCell>{events.find((e) => e.id === r.event_id)?.title}</TableCell>
                        <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{r.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="mt-6 space-y-4">
          {!incidents.length && <p className="text-sm text-muted-foreground">No incidents reported.</p>}
          {incidents.map((i) => (
            <Card key={i.id} className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {i.incident_type} · {i.location}
                </CardTitle>
                <CardDescription>
                  {new Date(i.created_at).toLocaleString()} · priority {i.priority} · status {i.status}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{i.description}</CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          {user && <ReportsPanel organizerId={user.id} />}
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
