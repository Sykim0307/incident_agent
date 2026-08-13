import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChecklistStep,
  IncidentEvent,
  IncidentKB,
  LedgerAccount,
  MtsOrder,
  NotificationRecord,
  RecoveryAction,
  SystemLog,
} from "@/lib/types";

export interface SnapshotOrder {
  id: string;
  account_id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  status: string;
}

export interface IncidentDetailBundle {
  event: IncidentEvent;
  steps: ChecklistStep[];
  sourceLog: SystemLog | null;
  matched: IncidentKB | null;
  recoveryActions: RecoveryAction[];
  snapshotOrders: SnapshotOrder[];
  accounts: LedgerAccount[];
  currentOrders: MtsOrder[];
  notifications: (NotificationRecord & {
    on_call_contacts: { name: string; role: string } | null;
  })[];
}

/**
 * Gathers every piece of data the IncidentDetail component needs for one
 * incident. Shared by the server-rendered /incidents/[id] page (anon
 * server client) and the dashboard's client-side detail panel (anon
 * browser client) - both use RLS-gated public read, so the same function
 * works from either context.
 */
export async function fetchIncidentDetailBundle(
  supabase: SupabaseClient,
  id: string
): Promise<IncidentDetailBundle | null> {
  const { data: event } = await supabase
    .from("incident_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!event) return null;

  const [
    { data: steps },
    { data: sourceLog },
    { data: matched },
    { data: actions },
    { data: snapshot },
    { data: notifications },
  ] = await Promise.all([
    supabase
      .from("checklist_progress")
      .select("*")
      .eq("incident_event_id", id)
      .order("step_no", { ascending: true }),
    event.source_log_id
      ? supabase.from("system_logs").select("*").eq("id", event.source_log_id).maybeSingle()
      : Promise.resolve({ data: null }),
    event.matched_incident_id
      ? supabase
          .from("incidents_kb")
          .select("*")
          .eq("id", event.matched_incident_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("recovery_actions")
      .select("*")
      .eq("incident_event_id", id)
      .order("executed_at", { ascending: false }),
    supabase
      .from("recovery_snapshots")
      .select("*")
      .eq("incident_event_id", id)
      .eq("table_name", "mts_orders")
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("*, on_call_contacts(name, role)")
      .eq("incident_event_id", id)
      .order("sent_at", { ascending: false }),
  ]);

  const snapshotOrders = (snapshot?.snapshot_data ?? []) as SnapshotOrder[];
  const orderIds = snapshotOrders.map((o) => o.id);
  const accountIds = [...new Set(snapshotOrders.map((o) => o.account_id))];

  const [{ data: accounts }, { data: currentOrders }] = await Promise.all([
    accountIds.length > 0
      ? supabase.from("ledger_accounts").select("*").in("id", accountIds)
      : Promise.resolve({ data: [] }),
    orderIds.length > 0
      ? supabase.from("mts_orders").select("*").in("id", orderIds)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    event: event as IncidentEvent,
    steps: (steps ?? []) as ChecklistStep[],
    sourceLog: sourceLog as SystemLog | null,
    matched: matched as IncidentKB | null,
    recoveryActions: (actions ?? []) as RecoveryAction[],
    snapshotOrders,
    accounts: (accounts ?? []) as LedgerAccount[],
    currentOrders: (currentOrders ?? []) as MtsOrder[],
    notifications: (notifications ?? []) as (NotificationRecord & {
      on_call_contacts: { name: string; role: string } | null;
    })[],
  };
}
