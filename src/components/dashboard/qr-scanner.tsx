import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const REGION_ID = "qr-scanner-region";

export function QrScanner({ onCode, busy }: { onCode: (code: string) => void; busy?: boolean }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    void (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(REGION_ID);
        scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            onCode(decoded);
          },
          () => {},
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera unavailable — use manual entry.");
        setActive(false);
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) void s.stop().then(() => s.clear()).catch(() => {});
    };
  }, [active, onCode]);

  return (
    <div className="space-y-4">
      <div
        id={REGION_ID}
        className={`overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 ${
          active ? "min-h-[240px]" : "flex min-h-[140px] items-center justify-center"
        }`}
      >
        {!active && <p className="text-sm text-muted-foreground">Camera is off</p>}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant={active ? "outline" : "default"} onClick={() => setActive((a) => !a)}>
          {active ? <CameraOff className="mr-2 size-4" /> : <Camera className="mr-2 size-4" />}
          {active ? "Stop camera" : "Start camera"}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) {
            onCode(manual.trim());
            setManual("");
          }
        }}
      >
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or paste the ticket code manually"
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          Check
        </Button>
      </form>
    </div>
  );
}
