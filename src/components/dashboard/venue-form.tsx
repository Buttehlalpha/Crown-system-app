import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

export interface VenueRow {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  capacity: number;
  warning_threshold: number;
  description: string | null;
}

const schema = z.object({
  name: z.string().trim().min(3, "Venue name is too short").max(120),
  address: z.string().trim().min(3, "Enter the venue address").max(200),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  capacity: z.number().int().positive("Capacity must be a positive number").max(1_000_000),
  warning_threshold: z
    .number()
    .int()
    .min(10, "Warning threshold must be at least 10%")
    .max(99, "Warning threshold must be below 100%"),
  description: z.string().trim().max(1000).optional(),
});

export function VenueFormDialog({ venue, trigger }: { venue?: VenueRow; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: form.get("name"),
      address: form.get("address"),
      city: form.get("city"),
      state: form.get("state"),
      capacity: Number(form.get("capacity")),
      warning_threshold: Number(form.get("warning_threshold")),
      description: form.get("description") || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }

    setBusy(true);
    const payload = { ...parsed.data, description: parsed.data.description ?? null };
    const { error } = venue
      ? await supabase.from("venues").update(payload).eq("id", venue.id)
      : await supabase.from("venues").insert(payload);
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(venue ? "Venue updated" : "Venue created");
    void qc.invalidateQueries({ queryKey: ["admin-venues"] });
    void qc.invalidateQueries({ queryKey: ["venues"] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{venue ? "Edit venue" : "Add venue"}</DialogTitle>
          <DialogDescription>Set the venue details, maximum capacity and warning threshold.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="venue-name">Venue name</Label>
            <Input id="venue-name" name="name" defaultValue={venue?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue-address">Address</Label>
            <Input id="venue-address" name="address" defaultValue={venue?.address} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="venue-city">City</Label>
              <Input id="venue-city" name="city" defaultValue={venue?.city ?? "Bauchi"} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-state">State</Label>
              <Input id="venue-state" name="state" defaultValue={venue?.state ?? "Bauchi State"} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="venue-capacity">Maximum capacity</Label>
              <Input
                id="venue-capacity"
                name="capacity"
                type="number"
                min={1}
                defaultValue={venue?.capacity ?? 500}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-threshold">Warning threshold (%)</Label>
              <Input
                id="venue-threshold"
                name="warning_threshold"
                type="number"
                min={10}
                max={99}
                defaultValue={venue?.warning_threshold ?? 80}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue-description">Description</Label>
            <Textarea id="venue-description" name="description" rows={3} defaultValue={venue?.description ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : venue ? "Save changes" : "Create venue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
