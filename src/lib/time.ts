/**
 * Pure time-formatting helpers. Callers must supply `nowMs` themselves
 * (e.g. from a ticking useState) rather than calling Date.now() here,
 * so these stay safe to call during render.
 */

export function formatRelativeTime(iso: string, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}초 전`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  return `${Math.floor(diffSec / 86400)}일 전`;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 60) return `${totalMin}분`;
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hours < 24) return min > 0 ? `${hours}시간 ${min}분` : `${hours}시간`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}일 ${remHours}시간` : `${days}일`;
}
