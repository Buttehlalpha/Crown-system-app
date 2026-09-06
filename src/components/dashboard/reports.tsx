import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileBarChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crowdStatus } from "@/lib/crowd";

interface Row {
  event: string;
  venue: string;
  date: string;
  status: string;
  capacity: number;
  registrations: number;
  checkedIn: number;
  insideNow: number;
  peakStatus: string;
  incidents: number;
}

export function ReportsPanel({ organizerId }: { organizerId?: string }) {
  const [scope, setScope] = useState<"all" | "published" | "completed">("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["reports", organizerId ?? "all"],
    queryFn: async (): Promise<Row[]> => {
      let q = supabase
        .from("events")
        .select("id, title, starts_at, status, capacity, current_occupancy, venue:venues(name, warning_threshold)")
        .order("starts_at", { ascending: false });
      if (organizerId) q = q.eq("organizer_id", organizerId);
      const { data: events } = await q;

      const ids = (events ?? []).map((e) => e.id);
      const [{ data: tickets }, { data: attendance }, { data: incidents }] = await Promise.all([
        supabase.from("tickets").select("id, event_id").in("event_id", ids.length ? ids : ["none"]),
        supabase.from("attendance").select("id, event_id, status").in("event_id", ids.length ? ids : ["none"]),
        supabase.from("incidents").select("id, event_id").in("event_id", ids.length ? ids : ["none"]),
      ]);

      return (events ?? []).map((e) => {
        const reg = (tickets ?? []).filter((t) => t.event_id === e.id).length;
        const att = (attendance ?? []).filter((a) => a.event_id === e.id);
        const venue = Array.isArray(e.venue) ? e.venue[0] : e.venue;
        return {
          event: e.title,
          venue: venue?.name ?? "—",
          date: new Date(e.starts_at).toLocaleDateString(),
          status: e.status,
          capacity: e.capacity,
          registrations: reg,
          checkedIn: att.length,
          insideNow: e.current_occupancy,
          peakStatus: crowdStatus(e.current_occupancy, e.capacity, venue?.warning_threshold ?? 80).label,
          incidents: (incidents ?? []).filter((i) => i.event_id === e.id).length,
        };
      });
    },
  });

  const filtered = useMemo(
    () => (scope === "all" ? rows : rows.filter((r) => r.status === scope)),
    [rows, scope],
  );

  const downloadCsv = () => {
    const header = [
      "Event",
      "Venue",
      "Date",
      "Status",
      "Capacity",
      "Registrations",
      "Total check-ins",
      "Inside now",
      "Crowd status",
      "Incidents",
    ];
    const body = filtered.map((r) =>
      [r.event, r.venue, r.date, r.status, r.capacity, r.registrations, r.checkedIn, r.insideNow, r.peakStatus, r.incidents]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crowdguard-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = filtered.reduce(
    (acc, r) => ({
      registrations: acc.registrations + r.registrations,
      checkedIn: acc.checkedIn + r.checkedIn,
      incidents: acc.incidents + r.incidents,
    }),
    { registrations: 0, checkedIn: 0, incidents: 0 },
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileBarChart className="size-5" /> Reports
          </CardTitle>
          <CardDescription>Events, attendance, crowd performance and incidents.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={downloadCsv} disabled={!filtered.length}>
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase text-muted-foreground">Registrations</p>
            <p className="text-xl font-bold">{totals.registrations}</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase text-muted-foreground">Total check-ins</p>
            <p className="text-xl font-bold">{totals.checkedIn}</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase text-muted-foreground">Incidents</p>
            <p className="text-xl font-bold">{totals.incidents}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Cap.</TableHead>
                <TableHead>Reg.</TableHead>
                <TableHead>Check-ins</TableHead>
                <TableHead>Inside</TableHead>
                <TableHead>Crowd</TableHead>
                <TableHead>Incidents</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={9}>Loading…</TableCell>
                </TableRow>
              )}
              {!isLoading && !filtered.length && (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    No data yet.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.event + r.date}>
                  <TableCell className="font-medium">{r.event}</TableCell>
                  <TableCell>{r.venue}</TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>{r.capacity}</TableCell>
                  <TableCell>{r.registrations}</TableCell>
                  <TableCell>{r.checkedIn}</TableCell>
                  <TableCell>{r.insideNow}</TableCell>
                  <TableCell>{r.peakStatus}</TableCell>
                  <TableCell>{r.incidents}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
