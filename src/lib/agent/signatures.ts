const ERROR_SIGNATURE_PATTERNS: RegExp[] = [
  /[A-Za-z.]+(?:Exception|Error)\b/g,
  /\b[45]\d{2}\b(?=\s|$|[^\d])/g,
  /\bTimeout\b|\btimed out\b|\btimeout\b/gi,
  /\bLock wait\b|\bdeadlock\b/gi,
  /\bconnection pool\b|\bconnection refused\b/gi,
  /\brate limit\b/gi,
  /\bconsumer lag\b|\bmessage queue\b|\bMQ\b/g,
];

export function extractErrorSignatures(logText: string): string[] {
  const found: string[] = [];
  for (const pattern of ERROR_SIGNATURE_PATTERNS) {
    for (const match of logText.matchAll(pattern)) {
      const token = match[0].trim();
      if (token && !found.includes(token)) {
        found.push(token);
      }
    }
  }
  return found;
}
