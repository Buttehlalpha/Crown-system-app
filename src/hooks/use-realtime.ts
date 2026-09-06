import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Invalidate the given query keys whenever any of the tables change. */
export function useRealtimeInvalidate(tables: string[], keys: string[], channelName = "live") {
  const qc = useQueryClient();
  const tableKey = tables.join(",");
  const queryKey = keys.join(",");

  useEffect(() => {
    const channel = supabase.channel(`${channelName}-${tableKey}`);
    tableKey.split(",").forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        queryKey.split(",").forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
      });
    });
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tableKey, queryKey, channelName, qc]);
}
