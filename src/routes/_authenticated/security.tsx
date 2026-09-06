import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, LogIn, LogOut, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { checkIn, checkOut, type ScanResult } from "@/lib/checkin";
import { DashboardShell } from "@/components/dashboard/shell";
import { OccupancyCard, type LiveEvent } from "@/components/dashboard/occupancy-card";
import { QrScanner } from "@/components/dashboard/qr-scanner";
import { IncidentFormDialog } from "@/components/dashboard/incident-form";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => ({
    meta: [
      { title: "Security dashboard — CrowdGuard Bauchi" },
      { name: "description", content: "Scan QR tickets, control entry and exit, and report incidents in real time." },
      { property: "og:title", content: "Security dashboard — CrowdGuard Bauchi" },
      { property: "og:description", content: "Gate control, capacity enforcement and incident reporting." },
    ],
  }),
  component: SecurityDashboard,
});

const ZONES = ["Main Gate", "Gate B", "VIP Entrance", "Hall A", "Hall B", "Exit Gate"];

function SecurityDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [eventId, setEventId] = useState<string>("");
  const [zone, setZone] = useState<string>(ZONES[0]!);
  const [mode, setMode] = useState<"entry" | "exit">("entry");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);

  useRealtimeInvalidate(["events", "attendance"], ["security-events", "zone-attendance"], "security");

  const { data: events = [] } = useQuery({
    queryKey: ["security-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, capacity, current_occupancy, status, starts_at, venue:venues(name, warning_threshold)")
        .in("status", ["published", "active"])
        .order("starts_at");
      return (data ?? []).map((e) => ({
        ...e,
        venue: Array.isArray(e.venue) ? e.venue[0] : e.venue,
      })) as LiveEvent[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["my-assignments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("event_assignments").select("event_id, zone").eq("officer_id", user!.id);
      return data ?? [];
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["zone-attendance", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("id, checked_in_at, checked_out_at, status, zone, attendee:profiles(full_name, email)")
        .eq("event_id", eventId)
        .order("checked_in_at", { ascending: false })
        .limit(15);
      return data ?? [];
    },
  });

  const selected = events.find((e) => e.id === eventId);
  const assignedIds = assignments.map((a) => a.event_id);
  const visibleEvents = assignedIds.length ? events.filter((e) => assignedIds.includes(e.id)) : events;

  const handleCode = useCallback(
    async (code: string) => {
      if (!user || !eventId) return;
      setBusy(true);
      const res =
        mode === "entry" ? await checkIn(code, user.id, zone, eventId) : await checkOut(code, eventId);
      setBusy(false);
      setResult(res);
      void qc.invalidateQueries({ queryKey: ["security-events"] });
      void qc.invalidateQueries({ queryKey: ["zone-attendance"] });
    },
    [user, eventId, mode, zone, qc],
  );

  return (
    <DashboardShell
      title="Gate control"
      description="Select your event and zone, then scan attendee QR codes to allow or reject entry."
      actions={
        eventId && user ? (
          <IncidentFormDialog
            eventId={eventId}
            reporterId={user.id}
            trigger={
              <Button variant="destructive">
                <AlertTriangle className="mr-2 size-4" /> Report incident
              </Button>
            }
          />
        ) : undefined
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
              <CardDescription>
                {assignedIds.length
                  ? "Showing events you are assigned to."
                  : "No assignment yet — showing all active events."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Event</p>
                <Select value={eventId} onValueChange={setEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleEvents.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Zone</p>
                <Select value={zone} onValueChange={setZone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONES.map((z) => (
                      <SelectItem key={z} value={z}>
                        {z}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selected && <OccupancyCard event={selected} />}

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Recent movement</CardTitle>
              <CardDescription>Latest check-ins and exits for this event.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Attendee</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!recent.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No movement recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {recent.map((a) => {
                    const p = Array.isArray(a.attendee) ? a.attendee[0] : a.attendee;
                    return (
                      <TableRow key={a.id}>
                        <TableCell>{p?.full_name || p?.email || "Attendee"}</TableCell>
                        <TableCell>{a.zone}</TableCell>
                        <TableCell>{new Date(a.checked_in_at).toLocaleTimeString()}</TableCell>
                        <TableCell>
                          {a.checked_out_at ? (
                            new Date(a.checked_out_at).toLocaleTimeString()
                          ) : (
                            <Badge variant="secondary">Inside</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Scan ticket</CardTitle>
            <CardDescription>
              The system validates the ticket, checks for duplicates and enforces venue capacity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex gap-2">
              <Button
                variant={mode === "entry" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setMode("entry")}
              >
                <LogIn className="mr-2 size-4" /> Entry
              </Button>
              <Button
                variant={mode === "exit" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setMode("exit")}
              >
                <LogOut className="mr-2 size-4" /> Exit
              </Button>
            </div>

            {!eventId ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Select an event to start scanning.
              </p>
            ) : (
              <QrScanner onCode={(c) => void handleCode(c)} busy={busy} />
            )}

            {result && (
              <div
                className={`rounded-xl border p-5 ${
                  result.ok
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-destructive/40 bg-destructive/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  {result.ok ? (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  ) : (
                    <XCircle className="size-5 text-destructive" />
                  )}
                  <p className="font-semibold">{result.reason}</p>
                </div>
                {result.detail && <p className="mt-1 text-sm text-muted-foreground">{result.detail}</p>}
                {result.attendee && <p className="mt-2 text-sm">Attendee: {result.attendee}</p>}
                {result.capacity !== undefined && (
                  <p className="text-sm">
                    Occupancy: {result.occupancy}/{result.capacity}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
