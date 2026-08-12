import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { runVerification } from "@/lib/agent/verify";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/incidents/[id]/verify">
) {
  const { id } = await ctx.params;
  const supabase = createServiceSupabaseClient();

  const result = await runVerification(supabase, id);
  return NextResponse.json(result);
}
