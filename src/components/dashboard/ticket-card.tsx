import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export interface TicketRow {
  id: string;
  qr_code: string;
  status: string;
  created_at: string;
  event: {
    id: string;
    title: string;
    starts_at: string;
    venue?: { name: string; address: string } | null;
  } | null;
}

export function TicketCard({ ticket, holder }: { ticket: TicketRow; holder: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(ticket.qr_code, { width: 420, margin: 1 });
      if (active) setDataUrl(url);
    })();
    return () => {
      active = false;
    };
  }, [ticket.qr_code]);

  return (
    <Card className="overflow-hidden border-border/60">
      <div className="flex items-center justify-between bg-primary px-5 py-3 text-primary-foreground">
        <p className="truncate font-semibold">{ticket.event?.title ?? "Event"}</p>
        <Badge
          className={
            ticket.status === "valid"
              ? "bg-emerald-500/20 text-emerald-100"
              : ticket.status === "used"
                ? "bg-accent/25 text-accent"
                : "bg-red-500/20 text-red-100"
          }
        >
          {ticket.status}
        </Badge>
      </div>
      <CardContent className="grid gap-5 p-5 sm:grid-cols-[160px_1fr]">
        <div className="flex items-center justify-center rounded-lg border border-border bg-white p-3">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR code for ${ticket.event?.title ?? "ticket"}`} width={160} height={160} />
          ) : (
            <div className="size-[136px] animate-pulse rounded bg-muted" />
          )}
        </div>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Holder: </span>
            {holder}
          </p>
          <p>
            <span className="text-muted-foreground">Venue: </span>
            {ticket.event?.venue?.name ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Starts: </span>
            {ticket.event ? new Date(ticket.event.starts_at).toLocaleString() : "—"}
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">{ticket.qr_code}</p>
          <Button asChild size="sm" variant="outline" disabled={!dataUrl}>
            <a href={dataUrl} download={`ticket-${ticket.qr_code}.png`}>
              <Download className="mr-2 size-4" /> Save ticket
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
