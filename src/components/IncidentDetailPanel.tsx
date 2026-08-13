"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  fetchIncidentDetailBundle,
  type IncidentDetailBundle,
} from "@/lib/agent/incidentDetailBundle";
import IncidentDetail from "@/components/IncidentDetail";

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center min-h-[300px] border border-rule rounded bg-surface text-sm text-ink-faint p-8 text-center">
      {text}
    </div>
  );
}

export default function IncidentDetailPanel({ eventId }: { eventId: string | null }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [loaded, setLoaded] = useState<{
    eventId: string;
    bundle: IncidentDetailBundle | null;
  } | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    fetchIncidentDetailBundle(supabase, eventId).then((result) => {
      if (!cancelled) setLoaded({ eventId, bundle: result });
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, supabase]);

  if (!eventId) {
    return <Placeholder text="좌측에서 장애를 선택하면 상세 정보가 여기 표시됩니다." />;
  }

  const isCurrent = loaded?.eventId === eventId;
  if (!isCurrent) {
    return <Placeholder text="불러오는 중…" />;
  }
  if (!loaded.bundle) {
    return <Placeholder text="장애 정보를 찾을 수 없습니다." />;
  }

  return (
    <div className="border border-rule rounded bg-surface">
      <IncidentDetail {...loaded.bundle} hideBackLink />
    </div>
  );
}
