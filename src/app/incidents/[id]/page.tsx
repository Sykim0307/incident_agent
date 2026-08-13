import { notFound } from "next/navigation";
import IncidentDetail from "@/components/IncidentDetail";
import { createAnonSupabaseClient } from "@/lib/supabase/server";
import { fetchIncidentDetailBundle } from "@/lib/agent/incidentDetailBundle";

export const dynamic = "force-dynamic";

export default async function IncidentPage({
  params,
}: PageProps<"/incidents/[id]">) {
  const { id } = await params;
  const supabase = createAnonSupabaseClient();

  const bundle = await fetchIncidentDetailBundle(supabase, id);
  if (!bundle) notFound();

  return <IncidentDetail {...bundle} />;
}
