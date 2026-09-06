import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, CalendarDays, CalendarPlus, Plus, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleLabels, type AppRole } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { OccupancyCard, type LiveEvent } from "@/components/dashboard/occupancy-card";
import { ReportsPanel } from "@/components/dashboard/reports";
import { EventFormDialog, type EventRow } from "@/components/dashboard/event-form";
import { VenueFormDialog, type VenueRow } from "@/components/dashboard/venue-form";
import { OfficerManager } from "@/components/dashboard/officer-manager";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administrator dashboard — CrowdGuard Bauchi" },
      { name: "description", content: "Monitor venues, live crowd levels, alerts and incidents across all events." },
      { property: "og:title", content: "Administrator dashboard — CrowdGuard Bauchi" },
      { property: "og:description", content: "Users, venues, events, alerts and incident oversight." },
    ],
  }),
  component: AdminDashboard,
});

const ROLES: AppRole[] = ["administrator", "organizer", "attendee", "security_officer"];

function AdminDashboard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  useRealtimeInvalidate(
    ["events", "incidents", "alerts", "venues", "attendance", "event_assignments"],
    ["admin-events", "admin-incidents", "admin-alerts", "admin-venues", "assignments"],
    "admin",
  );

  const { data: venues = [] } = useQuery({
    queryKey: ["admin-venues"],
    queryFn: async () => (await supabase.from("venues").select("*").order("name")).data ?? [],
  });

  const { data: events = [] } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("*, venue:venues(name, warning_threshold)")
        .order("starts_at", { ascending: false });
      return (data ?? []).map((e) => ({ ...e, venue: Array.isArray(e.venue) ? e.venue[0] : e.venue }));
    },
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["admin-incidents"],
    queryFn: async () =>
      (await supabase.from("incidents").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: async () =>
      (await supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });

  const { data: people = [] } = useQuery({
    queryKey: ["admin-people"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
      }));
    },
  });

  const changeRole = async (userId: string, role: AppRole) => {
    const { error: delError } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delError) {
      toast.error(delError.message);
      return;
    }
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Role updated to ${roleLabels[role]}`);
    void qc.invalidateQueries({ queryKey: ["admin-people"] });
    void qc.invalidateQueries({ queryKey: ["security-officers"] });
  };

  const setEventStatus = async (id: string, status: "published" | "active" | "completed" | "cancelled") => {
    const { error } = await supabase.from("events").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Event ${status}`);
    void qc.invalidateQueries({ queryKey: ["admin-events"] });
  };

  const deleteEvent = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event deleted");
    void qc.invalidateQueries({ queryKey: ["admin-events"] });
  };

  const acknowledgeAlert = async (id: string) => {
    const { error } = await supabase.from("alerts").update({ acknowledged: true }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["admin-alerts"] });
  };

  const updateIncident = async (id: string, status: "pending" | "in_progress" | "resolved") => {
    const { error } = await supabase.from("incidents").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Incident marked ${status.replace("_", " ")}`);
    void qc.invalidateQueries({ queryKey: ["admin-incidents"] });
  };

  const live = events.filter((e) => e.status === "published" || e.status === "active");
  const totalInside = live.reduce((n, e) => n + (e.current_occupancy ?? 0), 0);

  return (
    <DashboardShell
      title="Administrator dashboard"
      description="Oversee users, venues, events, live crowd levels, alerts and incidents."
      actions={
        user ? (
          <>
            <VenueFormDialog
              trigger={
                <Button variant="outline">
                  <Plus className="mr-2 size-4" /> Add venue
                </Button>
              }
            />
            <EventFormDialog
              organizerId={user.id}
              trigger={
                <Button>
                  <CalendarPlus className="mr-2 size-4" /> Create event
                </Button>
              }
            />
          </>
        ) : undefined
      }
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Users" value={people.length} />
        <StatCard icon={Building2} label="Venues" value={venues.length} />
        <StatCard icon={CalendarDays} label="Live events" value={live.length} hint={`${totalInside} inside now`} />
        <StatCard
          icon={AlertTriangle}
          label="Open incidents"
          value={incidents.filter((i) => i.status !== "resolved").length}
        />
      </div>

      <Tabs defaultValue="monitor">
        <TabsList className="flex-wrap">
          <TabsTrigger value="monitor">Live monitoring</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="users">Users & roles</TabsTrigger>
          <TabsTrigger value="venues">Venues</TabsTrigger>
          <TabsTrigger value="officers">Security officers</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="monitor" className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {!live.length && <p className="text-sm text-muted-foreground">No active events right now.</p>}
          {live.map((e) => (
            <OccupancyCard key={e.id} event={e as unknown as LiveEvent} />
          ))}
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          <Card className="border-border/60">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead>Occupancy</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!events.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        No events yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.title}</TableCell>
                      <TableCell>{e.venue?.name}</TableCell>
                      <TableCell>{new Date(e.starts_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {e.current_occupancy}/{e.capacity}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.status === "published" || e.status === "active" ? "default" : "secondary"}>
                          {e.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        {user && (
                          <EventFormDialog
                            organizerId={e.organizer_id ?? user.id}
                            event={e as unknown as EventRow}
                            trigger={
                              <Button size="sm" variant="outline">
                                Edit
                              </Button>
                            }
                          />
                        )}
                        {e.status === "draft" && (
                          <Button size="sm" onClick={() => void setEventStatus(e.id, "published")}>
                            <Send className="mr-1 size-3.5" /> Publish
                          </Button>
                        )}
                        {e.status === "published" && (
                          <Button size="sm" variant="secondary" onClick={() => void setEventStatus(e.id, "active")}>
                            Start
                          </Button>
                        )}
                        {e.status === "active" && (
                          <Button size="sm" variant="secondary" onClick={() => void setEventStatus(e.id, "completed")}>
                            Complete
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => void deleteEvent(e.id)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card className="border-border/60">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Current role</TableHead>
                    <TableHead className="w-56">Change role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.full_name}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell className="space-x-1">
                        {p.roles.length ? (
                          p.roles.map((r) => (
                            <Badge key={r} variant="secondary">
                              {roleLabels[r]}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select value={p.roles[0] ?? ""} onValueChange={(v) => void changeRole(p.id, v as AppRole)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Assign role" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {roleLabels[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="venues" className="mt-6">
          <Card className="border-border/60">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venue</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Warning threshold</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venues.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell>{v.address}</TableCell>
                      <TableCell>{v.capacity.toLocaleString()}</TableCell>
                      <TableCell>{v.warning_threshold}%</TableCell>
                      <TableCell className="text-right">
                        <VenueFormDialog
                          venue={v as unknown as VenueRow}
                          trigger={
                            <Button size="sm" variant="outline">
                              Edit capacity
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="officers" className="mt-6">
          <OfficerManager />
        </TabsContent>

        <TabsContent value="alerts" className="mt-6 space-y-3">
          {!alerts.length && <p className="text-sm text-muted-foreground">No alerts.</p>}
          {alerts.map((a) => (
            <Card key={a.id} className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {a.alert_type} · {a.severity}
                </CardTitle>
                <CardDescription>{new Date(a.created_at).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{a.message}</span>
                {a.acknowledged ? (
                  <Badge variant="secondary">Acknowledged</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void acknowledgeAlert(a.id)}>
                    Acknowledge
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="incidents" className="mt-6 space-y-3">
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
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{i.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void updateIncident(i.id, "pending")}>
                    Pending
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void updateIncident(i.id, "in_progress")}>
                    In progress
                  </Button>
                  <Button size="sm" onClick={() => void updateIncident(i.id, "resolved")}>
                    Resolved
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <ReportsPanel />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
