import { crowdStatus, toneBar, toneClasses } from "@/lib/crowd";
import { Card, CardContent } from "@/components/ui/card";

export interface LiveEvent {
  id: string;
  title: string;
  capacity: number;
  current_occupancy: number;
  status: string;
  starts_at: string;
  venue?: { name: string; warning_threshold: number } | null;
}

export function OccupancyCard({ event }: { event: LiveEvent }) {
  const status = crowdStatus(event.current_occupancy, event.capacity, event.venue?.warning_threshold ?? 80);

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{event.title}</h3>
            <p className="truncate text-xs text-muted-foreground">
              {event.venue?.name ?? "Venue"} · {new Date(event.starts_at).toLocaleString()}
            </p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[status.tone]}`}>
            {status.label}
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold">{event.current_occupancy}</span>
          <span className="text-sm text-muted-foreground">/ {event.capacity} inside</span>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${toneBar[status.tone]}`}
            style={{ width: `${status.percent}%` }}
          />
        </div>

        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>Warning level at {status.warningLevel}</span>
          <span>{status.available} spaces available</span>
        </div>
      </CardContent>
    </Card>
  );
}
