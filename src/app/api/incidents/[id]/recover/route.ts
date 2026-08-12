import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { runRecovery } from "@/lib/agent/recover";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/incidents/[id]/recover">
) {
  const { id } = await ctx.params;
  const supabase = createServiceSupabaseClient();

  const result = await runRecovery(supabase, id);
  return NextResponse.json(result);
}
