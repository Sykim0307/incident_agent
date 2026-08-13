import type { OnCallContact } from "@/lib/types";

export default function OnCallRoster({ contacts }: { contacts: OnCallContact[] }) {
  if (contacts.length === 0) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      <span className="font-mono uppercase tracking-wide text-ink-faint">현재 당직자</span>
      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-faint">
        가명 · 데모용 가상 인물
      </span>
      {contacts.map((c) => (
        <span
          key={c.id}
          className="rounded border border-rule bg-surface px-2.5 py-1 text-ink-soft"
        >
          {c.name} · {c.role} · {c.channel.toUpperCase()}
        </span>
      ))}
    </div>
  );
}
