import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const ZONES = ["Main Gate", "Gate B", "VIP Entrance", "Hall A", "Hall B", "Exit Gate"];

export function OfficerManager() {
  const qc = useQueryClient();
  const [officerId, setOfficerId] = useState("");
  const [eventId, setEventId] = useState("");
  const [zone, setZone] = useState(ZONES[0]!);
  const [busy, setBusy] = useState(false);

  const { data: officers = [] } = useQuery({
    queryKey: ["security-officers"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "security_officer");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["assignable-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, status")
        .in("status", ["published", "active"])
        .order("starts_at");
      return data ?? [];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_assignments")
        .select("id, zone, officer_id, event_id, created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const assign = async () => {
    if (!officerId || !eventId) {
      toast.error("Select an officer and an event");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("event_assignments")
      .insert({ officer_id: officerId, event_id: eventId, zone });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Officer assigned");
    void qc.invalidateQueries({ queryKey: ["assignments"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("event_assignments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assignment removed");
    void qc.invalidateQueries({ queryKey: ["assignments"] });
  };

  const officerName = (id: string) => {
    const o = officers.find((x) => x.id === id);
    return o?.full_name || o?.email || "Officer";
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Assign a security officer</CardTitle>
          <CardDescription>Give officers an event and a zone so they can open gate control.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Officer</p>
            <Select value={officerId} onValueChange={setOfficerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select officer" />
              </SelectTrigger>
              <SelectContent>
                {officers.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.full_name || o.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Event</p>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger>
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
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
          <div className="flex items-end">
            <Button className="w-full" onClick={() => void assign()} disabled={busy}>
              <UserPlus className="mr-2 size-4" /> Assign
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Officer</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!assignments.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No officers assigned yet.
                  </TableCell>
                </TableRow>
              )}
              {assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{officerName(a.officer_id)}</TableCell>
                  <TableCell>{events.find((e) => e.id === a.event_id)?.title ?? "—"}</TableCell>
                  <TableCell>{a.zone}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => void remove(a.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
