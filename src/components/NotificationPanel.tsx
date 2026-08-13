"use client";

import { useState } from "react";
import type { NotificationRecord } from "@/lib/types";

type NotificationWithContact = NotificationRecord & {
  on_call_contacts: { name: string; role: string } | null;
};

interface Props {
  incidentEventId: string;
  initialNotifications: NotificationWithContact[];
}

function maskRecipient(value: string): string {
  if (value.length <= 4) return value;
  return `${value.slice(0, -4)}${"*".repeat(4)}`;
}

export default function NotificationPanel({ incidentEventId, initialNotifications }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    try {
      const res = await fetch(`/api/incidents/${incidentEventId}/notify`, { method: "POST" });
      const data = await res.json();
      const sent = (data.sent ?? []) as NotificationRecord[];
      setNotifications((prev) => [
        ...sent.map((n) => ({ ...n, on_call_contacts: null })),
        ...prev,
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          당직자 알림 (시뮬레이션)
        </h2>
        <span className="rounded bg-accent-soft text-accent-ink px-2 py-0.5 text-[10px] font-semibold">
          시뮬레이션 · 실제 발송 아님
        </span>
      </div>

      <div className="border border-rule rounded bg-surface divide-y divide-rule">
        {notifications.length === 0 && (
          <p className="p-3 text-sm text-ink-faint">아직 발송된 알림이 없습니다.</p>
        )}
        {notifications.map((n) => (
          <div key={n.id} className="p-3 text-xs flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono uppercase text-[10px]">
                {n.channel}
              </span>
              <span className="text-ink-soft">
                {n.on_call_contacts ? `${n.on_call_contacts.name} · ${n.on_call_contacts.role}` : "당직 담당자"}
              </span>
              <span className="text-ink-faint">{maskRecipient(n.recipient)}</span>
              <span className="text-ink-faint ml-auto whitespace-nowrap">
                {new Date(n.sent_at).toLocaleString("ko-KR")}
              </span>
            </div>
            <p className="text-ink">{n.message}</p>
          </div>
        ))}
      </div>

      <div>
        <button
          onClick={resend}
          disabled={sending}
          className="rounded border border-rule bg-surface px-3 py-2 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
        >
          {sending ? "발송 중…" : "당직자에게 알림 재전송 (시뮬레이션)"}
        </button>
      </div>
    </section>
  );
}
