import Dashboard from "@/components/Dashboard";
import { createAnonSupabaseClient } from "@/lib/supabase/server";
import type { IncidentEvent, IncidentKB, OnCallContact, SystemLog } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createAnonSupabaseClient();

  const [{ data: logs }, { data: events }, { data: kb }, { data: contacts }] = await Promise.all([
    supabase
      .from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("incident_events")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(200),
    supabase.from("incidents_kb").select("*"),
    supabase.from("on_call_contacts").select("*").eq("active", true),
  ]);

  return (
    <Dashboard
      initialLogs={(logs ?? []) as SystemLog[]}
      initialEvents={(events ?? []) as IncidentEvent[]}
      knowledgeBase={(kb ?? []) as IncidentKB[]}
      onCallContacts={(contacts ?? []) as OnCallContact[]}
    />
  );
}
