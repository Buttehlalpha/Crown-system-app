import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  venue_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: string;
}

const schema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(120),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().min(2).max(40),
  venue_id: z.string().uuid("Select a venue"),
  starts_at: z.string().min(1, "Select a start time"),
  ends_at: z.string().min(1, "Select an end time"),
  capacity: z.number().int().positive("Capacity must be positive"),
});

const toLocalInput = (iso: string) => new Date(iso).toISOString().slice(0, 16);

export function EventFormDialog({
  organizerId,
  event,
  trigger,
}: {
  organizerId: string;
  event?: EventRow;
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [venueId, setVenueId] = useState(event?.venue_id ?? "");
  const [capacity, setCapacity] = useState<number | "">(event?.capacity ?? "");
  const [busy, setBusy] = useState(false);

  const { data: venues } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data } = await supabase.from("venues").select("*").order("name");
      return data ?? [];
    },
  });

  const selectedVenue = venues?.find((v) => v.id === venueId);

  useEffect(() => {
    if (!event && selectedVenue) setCapacity(selectedVenue.capacity);
  }, [selectedVenue, event]);

  const submit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      title: form.get("title"),
      description: form.get("description") || undefined,
      category: form.get("category"),
      venue_id: venueId,
      starts_at: form.get("starts_at"),
      ends_at: form.get("ends_at"),
      capacity: Number(capacity),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    if (selectedVenue && parsed.data.capacity > selectedVenue.capacity) {
      toast.error(`Capacity cannot exceed the venue limit of ${selectedVenue.capacity}`);
      return;
    }
    if (new Date(parsed.data.ends_at) <= new Date(parsed.data.starts_at)) {
      toast.error("The event must end after it starts");
      return;
    }

    setBusy(true);
    const payload = {
      ...parsed.data,
      description: parsed.data.description ?? null,
      starts_at: new Date(parsed.data.starts_at).toISOString(),
      ends_at: new Date(parsed.data.ends_at).toISOString(),
      organizer_id: organizerId,
    };
    const { error } = event
      ? await supabase.from("events").update(payload).eq("id", event.id)
      : await supabase.from("events").insert(payload);
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(event ? "Event updated" : "Event created as a draft");
    void qc.invalidateQueries({ queryKey: ["events"] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "Create event"}</DialogTitle>
          <DialogDescription>Enter the details, select a venue and confirm the capacity.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event title</Label>
            <Input id="title" name="title" defaultValue={event?.title} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" defaultValue={event?.category ?? "Conference"} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={event?.description ?? ""} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Venue</Label>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a venue" />
              </SelectTrigger>
              <SelectContent>
                {(venues ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} — {v.capacity.toLocaleString()} capacity
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedVenue && (
              <p className="text-xs text-muted-foreground">
                Venue limit {selectedVenue.capacity.toLocaleString()} · warning at {selectedVenue.warning_threshold}%
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="starts_at">Starts</Label>
              <Input
                id="starts_at"
                name="starts_at"
                type="datetime-local"
                defaultValue={event ? toLocalInput(event.starts_at) : ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ends_at">Ends</Label>
              <Input
                id="ends_at"
                name="ends_at"
                type="datetime-local"
                defaultValue={event ? toLocalInput(event.ends_at) : ""}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Confirmed capacity</Label>
            <Input
              id="capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value === "" ? "" : Number(e.target.value))}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : event ? "Save changes" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
