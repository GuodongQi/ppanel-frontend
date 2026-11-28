import request from "@workspace/ui/lib/request";

const prefix = import.meta.env.VITE_API_PREFIX || "";

export interface RealityScanConfig {
  enabled: boolean;
  daily_time: string;
  port: number;
  radius: number;
  scan_server_neighbors: boolean;
  seeds: string[];
  candidates: string[];
  auto_switch: boolean;
  score_margin: number;
  cooldown_hours: number;
  server_ids: number[];
  servers: RealityScanServerConfig[];
  threads: number;
  timeout_seconds: number;
  max_cert_bytes: number;
}

export interface RealityScanServerConfig {
  server_id: number;
  enabled: boolean;
  auto_switch: boolean;
  score_margin: number;
  cooldown_hours: number;
}

export interface RealityScanResult {
  ip: string;
  origin: string;
  dial_host: string;
  source: string;
  port: number;
  tls?: string;
  alpn?: string;
  curve?: string;
  cert_domain?: string;
  cert_issuer?: string;
  cert_bytes?: number;
  latency_ms?: number;
  feasible: boolean;
  score: number;
  error?: string;
  server_ids?: number[];
}

export interface RealityScanSwitch {
  server_id: number;
  server_name: string;
  protocol: string;
  from_sni: string;
  from_addr: string;
  to_sni?: string;
  to_addr?: string;
  to_port?: number;
  score?: number;
  reason: string;
}

export interface RealityScanReport {
  running: boolean;
  started_at?: string;
  finished_at?: string;
  last_completed?: string;
  last_attempt?: string;
  error?: string;
  scanned: number;
  feasible: number;
  truncated: boolean;
  applied: boolean;
  results: RealityScanResult[];
  switches: RealityScanSwitch[];
  edu_searches: RealityScanEduSearch[];
}

export interface RealityScanEduSearch {
  server_id: number;
  query?: string;
  domains: string[];
  error?: string;
}

export interface RealityScanView {
  config: RealityScanConfig;
  report: RealityScanReport;
}

export async function getRealityScan() {
  const { data } = await request.get<{ data: RealityScanView }>(
    `${prefix}/v1/admin/reality-scan/`
  );
  return data.data;
}

export async function updateRealityScan(config: RealityScanConfig) {
  const { data } = await request.put<{ data: RealityScanView }>(
    `${prefix}/v1/admin/reality-scan/`,
    config
  );
  return data.data;
}

export async function runRealityScan() {
  const { data } = await request.post<{ data: RealityScanView }>(
    `${prefix}/v1/admin/reality-scan/run`
  );
  return data.data;
}
