import { supabase } from "@/integrations/supabase/client";

export interface ScanResult {
  ok: boolean;
  reason: string;
  detail?: string;
  attendee?: string;
  eventTitle?: string;
  occupancy?: number;
  capacity?: number;
}

async function findTicket(code: string) {
  const { data } = await supabase
    .from("tickets")
    .select("id, event_id, attendee_id, status, qr_code")
    .eq("qr_code", code.trim())
    .maybeSingle();
  return data;
}

async function attendeeName(id: string) {
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle();
  return data?.full_name || data?.email || "Attendee";
}

export async function checkIn(
  code: string,
  officerId: string,
  zone: string,
  expectedEventId?: string,
): Promise<ScanResult> {
  const ticket = await findTicket(code);
  if (!ticket) return { ok: false, reason: "Invalid ticket", detail: "No ticket matches this QR code." };
  if (ticket.status === "cancelled")
    return { ok: false, reason: "Ticket cancelled", detail: "This ticket has been cancelled." };

  const { data: event } = await supabase
    .from("events")
    .select("id, title, capacity, current_occupancy, status")
    .eq("id", ticket.event_id)
    .maybeSingle();
  if (!event) return { ok: false, reason: "Event not found", detail: "The event for this ticket is unavailable." };
  if (expectedEventId && ticket.event_id !== expectedEventId)
    return {
      ok: false,
      reason: "Wrong event",
      detail: `This ticket is for "${event.title}", not the event you are scanning for.`,
      eventTitle: event.title,
    };
  if (event.status === "completed" || event.status === "cancelled")
    return {
      ok: false,
      reason: "Event closed",
      detail: "This event is no longer accepting entries.",
      eventTitle: event.title,
    };

  const { data: active } = await supabase
    .from("attendance")
    .select("id")
    .eq("ticket_id", ticket.id)
    .eq("status", "active")
    .maybeSingle();
  if (active)
    return {
      ok: false,
      reason: "Duplicate entry",
      detail: "This ticket is already checked in and has not exited.",
      eventTitle: event.title,
    };
  if (ticket.status === "used")
    return {
      ok: false,
      reason: "Ticket already used",
      detail: "This ticket has already been used for entry.",
      eventTitle: event.title,
    };

  if ((event.current_occupancy ?? 0) >= event.capacity)
    return {
      ok: false,
      reason: "Venue full",
      detail: `Capacity reached (${event.current_occupancy}/${event.capacity}). Entry blocked.`,
      eventTitle: event.title,
      occupancy: event.current_occupancy,
      capacity: event.capacity,
    };

  const { error } = await supabase.from("attendance").insert({
    ticket_id: ticket.id,
    event_id: ticket.event_id,
    attendee_id: ticket.attendee_id,
    officer_id: officerId,
    zone,
  });
  if (error) return { ok: false, reason: "Check-in failed", detail: error.message };

  await supabase.from("tickets").update({ status: "used" }).eq("id", ticket.id);

  return {
    ok: true,
    reason: "Entry approved",
    detail: `Checked in at ${zone}.`,
    attendee: await attendeeName(ticket.attendee_id),
    eventTitle: event.title,
    occupancy: (event.current_occupancy ?? 0) + 1,
    capacity: event.capacity,
  };
}

export async function checkOut(code: string, expectedEventId?: string): Promise<ScanResult> {
  const ticket = await findTicket(code);
  if (!ticket) return { ok: false, reason: "Invalid ticket", detail: "No ticket matches this QR code." };
  if (expectedEventId && ticket.event_id !== expectedEventId)
    return { ok: false, reason: "Wrong event", detail: "This ticket belongs to a different event." };

  const { data: active } = await supabase
    .from("attendance")
    .select("id, event_id")
    .eq("ticket_id", ticket.id)
    .eq("status", "active")
    .maybeSingle();
  if (!active)
    return { ok: false, reason: "No active check-in", detail: "This attendee is not currently inside the venue." };

  const { error } = await supabase
    .from("attendance")
    .update({ checked_out_at: new Date().toISOString(), status: "completed" })
    .eq("id", active.id);
  if (error) return { ok: false, reason: "Check-out failed", detail: error.message };

  return {
    ok: true,
    reason: "Exit recorded",
    detail: "Occupancy reduced by one.",
    attendee: await attendeeName(ticket.attendee_id),
  };
}
