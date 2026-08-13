export function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "critical" | "high";
}) {
  const toneClass =
    tone === "critical"
      ? "text-sev-critical"
      : tone === "high"
        ? "text-sev-high"
        : "text-ink";
  return (
    <div className="border border-rule rounded bg-surface px-4 py-3">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className={`text-2xl font-semibold mt-1 tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
