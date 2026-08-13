export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type LogLevel = "INFO" | "WARN" | "ERROR";

export type IncidentStatus =
  | "open"
  | "in_progress"
  | "verifying"
  | "resolved"
  | "escalated";

export interface SystemLog {
  id: string;
  source_system: string;
  level: LogLevel;
  message: string;
  raw_log: string;
  created_at: string;
}

export interface IncidentKB {
  id: string;
  title: string;
  system_name: string;
  keywords: string[];
  symptoms: string;
  root_cause: string;
  resolution: string[];
  severity: Severity;
  avg_resolution_min: number;
}

export interface ChecklistStep {
  id: string;
  incident_event_id: string;
  step_no: number;
  description: string;
  is_done: boolean;
  checked_at: string | null;
  verification_result: string | null;
}

export interface IncidentEvent {
  id: string;
  detected_at: string;
  source_log_id: string | null;
  source_system: string | null;
  detected_signatures: string[];
  matched_incident_id: string | null;
  similarity_score: number | null;
  severity: Severity | "UNKNOWN";
  status: IncidentStatus;
  checklist: string[];
  draft_report: string | null;
  llm_summary: string | null;
  resolved_at: string | null;
  resolution_method: "recovery" | "manual" | null;
  resolution_note: string | null;
}

export interface IncidentEventWithRelations extends IncidentEvent {
  matched_incident: IncidentKB | null;
  source_log: SystemLog | null;
  steps: ChecklistStep[];
}

export interface RecoverySnapshot {
  id: string;
  incident_event_id: string;
  table_name: string;
  snapshot_data: Record<string, unknown>[];
  label: string;
  taken_at: string;
}

export interface RecoveryAction {
  id: string;
  incident_event_id: string;
  snapshot_id: string | null;
  executed_at: string;
  result: "success" | "failed";
  verification_passed: boolean;
  detail: string | null;
}

export interface MtsOrder {
  id: string;
  account_id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  status: "pending" | "filled" | "failed" | "cancelled";
  created_at: string;
}

export interface LedgerAccount {
  id: string;
  account_no: string;
  customer_name: string;
  balance: number;
  updated_at: string;
}

export interface OnCallContact {
  id: string;
  name: string;
  role: string;
  channel: "sms" | "email";
  contact_address: string;
  system_scope: string[];
  active: boolean;
}

export interface NotificationRecord {
  id: string;
  incident_event_id: string;
  contact_id: string | null;
  channel: "sms" | "email";
  recipient: string;
  message: string;
  status: "sent" | "failed";
  sent_at: string;
  simulated: boolean;
}
