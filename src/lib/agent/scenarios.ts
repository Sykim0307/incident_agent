export interface LogTemplate {
  source_system: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  raw_log: string;
  /** incidents_kb.id this template is meant to resemble, if any */
  relatedIncidentId?: string;
  /** if set, running this template also perturbs mock MTS order data */
  impact?: "mts_orders_fail";
}

// 정상 상태에서 흘러가는 평범한 로그 (관제 화면이 "살아있게" 보이도록)
export const NORMAL_LOGS: LogTemplate[] = [
  {
    source_system: "HTS",
    level: "INFO",
    message: "로그인 처리 완료",
    raw_log: "INFO [was-worker] login success, response_time=120ms",
  },
  {
    source_system: "MTS",
    level: "INFO",
    message: "주문 체결 완료",
    raw_log: "INFO [order-svc] order filled, latency=45ms",
  },
  {
    source_system: "계정계 배치",
    level: "INFO",
    message: "정산 배치 정상 완료",
    raw_log: "INFO [settlement-batch] job SETTLE_DAILY_LEDGER completed, duration=812s",
  },
  {
    source_system: "OpenAPI",
    level: "INFO",
    message: "외부 제휴사 API 호출 정상",
    raw_log: "INFO [openapi-gw] 200 OK, latency=88ms",
  },
  {
    source_system: "웹 트레이딩",
    level: "WARN",
    message: "응답시간 소폭 증가 (임계치 이내)",
    raw_log: "WARN [web-fe] p95_latency=420ms (threshold 800ms)",
  },
];

// 장애성 로그 - 기존 프로토타입(prototype-cli/data/incidents.json)의 8개 사례와 1:1로 대응
export const INCIDENT_LOGS: LogTemplate[] = [
  {
    source_system: "HTS",
    level: "ERROR",
    message: "커넥션 풀 고갈로 로그인 지연",
    raw_log:
      "ERROR [was-worker-12] java.sql.SQLException: Cannot get a connection, pool error Timeout waiting for idle object\nWARN [monitor] active_connections=200/200 (max pool size reached)",
    relatedIncidentId: "INC-2024-0113",
  },
  {
    source_system: "MTS",
    level: "ERROR",
    message: "DB Lock 경합으로 주문 체결 지연",
    raw_log:
      "ERROR [order-svc] java.sql.SQLTransientException: Lock wait timeout exceeded; try restarting transaction\nERROR [order-svc] deadlock detected while updating ORD_STATUS table",
    relatedIncidentId: "INC-2024-0209",
    impact: "mts_orders_fail",
  },
  {
    source_system: "계정계 배치",
    level: "ERROR",
    message: "야간 정산 배치 OutOfMemoryError",
    raw_log:
      "ERROR [settlement-batch] java.lang.OutOfMemoryError: Java heap space\nERROR [settlement-batch] batch job SETTLE_DAILY_LEDGER terminated abnormally",
    relatedIncidentId: "INC-2024-0317",
  },
  {
    source_system: "OpenAPI",
    level: "ERROR",
    message: "토큰 만료 정책 변경으로 인증 실패 급증",
    raw_log:
      "ERROR [openapi-gw] 401 Unauthorized, reason=token_expired\nWARN [openapi-gw] unauthorized_rate=18% (threshold 2%)",
    relatedIncidentId: "INC-2024-0402",
  },
  {
    source_system: "계정계",
    level: "ERROR",
    message: "원장 동기화 메시지 큐 적체",
    raw_log:
      "ERROR [ledger-consumer] consumer lag increasing, lag=48210\nERROR [ledger-consumer] message queue backlog, retry loop detected",
    relatedIncidentId: "INC-2024-0511",
  },
  {
    source_system: "웹 트레이딩",
    level: "ERROR",
    message: "CDN 캐시 미스로 응답 지연",
    raw_log:
      "WARN [cdn] cache_hit_ratio=32% (avg 94%)\nERROR [web-fe] page_response_time=3400ms (threshold 800ms)",
    relatedIncidentId: "INC-2024-0623",
  },
  {
    source_system: "RPA",
    level: "ERROR",
    message: "외부 시세 API 타임아웃",
    raw_log:
      "ERROR [rpa-trader] Read timed out\nERROR [rpa-trader] external quote api timeout, retries_exhausted=3",
    relatedIncidentId: "INC-2024-0708",
  },
  {
    source_system: "대고객 알림",
    level: "ERROR",
    message: "발송사 Rate Limit 초과",
    raw_log:
      "ERROR [notify-gw] 429 Too Many Requests\nWARN [notify-gw] send_success_rate=61% (threshold 98%)",
    relatedIncidentId: "INC-2024-0819",
  },
];

// 지식베이스에 없는 신규 유형 - Agent가 "모른다"고 답하며 에스컬레이션하는 장면을 보여주기 위한 로그
export const UNKNOWN_PATTERN_LOGS: LogTemplate[] = [
  {
    source_system: "리포트 배치",
    level: "ERROR",
    message: "디스크 공간 부족",
    raw_log:
      "ERROR [file-svc] java.io.IOException: No space left on device\nWARN [monitor] disk usage /data partition = 99.8%",
  },
];

export function pickRandomLog(): LogTemplate {
  const roll = Math.random();
  if (roll < 0.55) {
    return NORMAL_LOGS[Math.floor(Math.random() * NORMAL_LOGS.length)];
  }
  if (roll < 0.92) {
    return INCIDENT_LOGS[Math.floor(Math.random() * INCIDENT_LOGS.length)];
  }
  return UNKNOWN_PATTERN_LOGS[Math.floor(Math.random() * UNKNOWN_PATTERN_LOGS.length)];
}
