import { useQuery } from "@tanstack/react-query";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Textarea } from "@workspace/ui/components/textarea";
import { getServerList } from "@workspace/ui/services/admin/admin";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  getRealityScan,
  type RealityScanConfig,
  type RealityScanView,
  runRealityScan,
  updateRealityScan,
} from "./api";

const emptyConfig: RealityScanConfig = {
  enabled: false,
  daily_time: "04:00",
  port: 443,
  radius: 16,
  scan_server_neighbors: true,
  seeds: [],
  candidates: [],
  auto_switch: false,
  score_margin: 400,
  cooldown_hours: 12,
  server_ids: [],
  threads: 8,
  timeout_seconds: 5,
  max_cert_bytes: 8192,
};

function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatWhen(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function RealityScan() {
  const { t } = useTranslation("reality-scan");
  const [config, setConfig] = useState<RealityScanConfig>(emptyConfig);
  const [seeds, setSeeds] = useState("");
  const [candidates, setCandidates] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const scan = useQuery({
    queryKey: ["reality-scan"],
    queryFn: getRealityScan,
    refetchInterval: (query) =>
      query.state.data?.report?.running ? 3000 : false,
  });
  const servers = useQuery({
    queryKey: ["reality-scan-servers"],
    queryFn: async () => {
      const { data } = await getServerList({ page: 1, size: 100 });
      return data.data?.list ?? [];
    },
  });

  useEffect(() => {
    if (hydrated || !scan.data?.config) return;
    setConfig({ ...emptyConfig, ...scan.data.config });
    setSeeds((scan.data.config.seeds ?? []).join("\n"));
    setCandidates((scan.data.config.candidates ?? []).join("\n"));
    setHydrated(true);
  }, [hydrated, scan.data]);

  function patch(partial: Partial<RealityScanConfig>) {
    setConfig((current) => ({ ...current, ...partial }));
  }

  function toggleServer(id: number, checked: boolean) {
    patch({
      server_ids: checked
        ? [...config.server_ids, id]
        : config.server_ids.filter((item) => item !== id),
    });
  }

  async function save() {
    setSaving(true);
    try {
      const view = await updateRealityScan({
        ...config,
        seeds: lines(seeds),
        candidates: lines(candidates),
      });
      applyView(view);
      toast.success(t("saved", "Saved"));
    } catch {
      toast.error(t("saveFailed", "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      const view = await runRealityScan();
      applyView(view);
      toast.success(t("started", "Scan started"));
    } catch {
      toast.error(t("startFailed", "Could not start the scan"));
    } finally {
      setRunning(false);
    }
  }

  function applyView(view: RealityScanView) {
    setConfig({ ...emptyConfig, ...view.config });
    setSeeds((view.config.seeds ?? []).join("\n"));
    setCandidates((view.config.candidates ?? []).join("\n"));
    scan.refetch();
  }

  const report = scan.data?.report;
  const reasons: Record<string, string> = {
    higher_score: t("reason.higher_score", "Switched to a higher score"),
    current_down: t("reason.current_down", "Current target is unreachable"),
    already_best: t("reason.already_best", "Current target remains the best"),
    margin: t("reason.margin", "Kept: the gain is inside the margin"),
    cooldown: t("reason.cooldown", "Kept: still in the cooldown"),
    no_feasible: t("reason.no_feasible", "No usable target"),
    conflict: t(
      "reason.conflict",
      "Skipped: the server changed during the scan"
    ),
    unreadable: t("reason.unreadable", "Protocols could not be read"),
    store_failed: t("reason.store_failed", "Protocols could not be stored"),
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl">
            {t("title", "Reality camouflage")}
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
            {t(
              "subtitle",
              "Probe only port 443 inside each checked VLESS server's /24. Region and ASN follow that server, not the panel machine. If the /24 has nothing usable, try a .edu site in the same area."
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button disabled={saving} onClick={save} variant="outline">
            {saving ? t("saving", "Saving…") : t("save", "Save")}
          </Button>
          <Button disabled={running || report?.running} onClick={runNow}>
            {report?.running
              ? t("scanning", "Scanning…")
              : t("runNow", "Scan now")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat
          label={t("stat.schedule", "Daily time")}
          value={config.enabled ? config.daily_time : t("stat.off", "Off")}
        />
        <Stat
          label={t("stat.last", "Last finished")}
          value={formatWhen(report?.finished_at)}
        />
        <Stat
          label={t("stat.feasible", "Usable targets")}
          value={String(report?.feasible ?? 0)}
        />
        <Stat
          label={t("stat.switched", "Protocols updated")}
          value={String(
            report?.switches?.filter((item) => item.to_addr).length ?? 0
          )}
        />
      </div>

      {report?.error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm">
          {report.error}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("schedule.title", "Schedule")}</CardTitle>
            <CardDescription>
              {t(
                "schedule.description",
                "The clock uses the panel time zone. A finished day does not run again."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Toggle
              checked={config.enabled}
              label={t("schedule.enabled", "Run every day")}
              onChange={(enabled) => patch({ enabled })}
            />
            <Field label={t("schedule.time", "Time")}>
              <Input
                onChange={(event) => patch({ daily_time: event.target.value })}
                type="time"
                value={config.daily_time}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("neighbors.title", "Neighbor scan")}</CardTitle>
            <CardDescription>
              {t(
                "neighbors.description",
                "Only the checked VLESS server's /24, and only port 443. TLS handshake plus one direct request, at most 20 at a time, rate limited. No port scan and no vulnerability probing. A target must offer TLS 1.3 and h2, a valid certificate that is not a CDN edge, a domain that resolves back to that neighbor, HTTP 200/301/302, and a low handshake delay. Cloudflare, Apple, Microsoft, Google, Amazon, Akamai, Fastly and similar sites are excluded."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Toggle
              checked={config.scan_server_neighbors}
              label={t(
                "neighbors.servers",
                "Scan the checked VLESS servers' /24"
              )}
              onChange={(scan_server_neighbors) =>
                patch({ scan_server_neighbors })
              }
            />
            <Field
              label={t(
                "neighbors.seeds",
                "Extra domains, one per line. Used only when they resolve inside a checked VLESS /24 or the same region."
              )}
            >
              <Textarea
                onChange={(event) => setSeeds(event.target.value)}
                placeholder="203.0.113.10"
                rows={4}
                value={seeds}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("candidates.title", "Candidate domains")}</CardTitle>
            <CardDescription>
              {t(
                "candidates.description",
                "CDN and popular names are ignored. If a /24 has no match, the scan tries a .edu site in the same country, state, or a nearby city, then checks DNS and IP geolocation."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              onChange={(event) => setCandidates(event.target.value)}
              placeholder={"mit.edu"}
              rows={8}
              value={candidates}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("switch.title", "Automatic switch")}</CardTitle>
          <CardDescription>
            {t(
              "switch.description",
              "A switch updates the Reality SNI and destination together and leaves the keys alone. Clients need a fresh subscription before the new SNI works."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Toggle
              checked={config.auto_switch}
              label={t("switch.enabled", "Apply the winning target")}
              onChange={(auto_switch) => patch({ auto_switch })}
            />
            <Field label={t("switch.margin", "Score margin")}>
              <Input
                min={0}
                onChange={(event) =>
                  patch({ score_margin: Number(event.target.value) })
                }
                type="number"
                value={config.score_margin}
              />
            </Field>
            <Field label={t("switch.cooldown", "Cooldown, hours")}>
              <Input
                min={1}
                onChange={(event) =>
                  patch({ cooldown_hours: Number(event.target.value) })
                }
                type="number"
                value={config.cooldown_hours}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t("switch.threads", "Threads")}>
                <Input
                  max={20}
                  min={1}
                  onChange={(event) =>
                    patch({ threads: Number(event.target.value) })
                  }
                  type="number"
                  value={config.threads}
                />
              </Field>
              <Field label={t("switch.timeout", "Timeout, seconds")}>
                <Input
                  max={10}
                  min={3}
                  onChange={(event) =>
                    patch({ timeout_seconds: Number(event.target.value) })
                  }
                  type="number"
                  value={config.timeout_seconds}
                />
              </Field>
              <Field label={t("switch.cert", "Max certificate bytes")}>
                <Input
                  min={1024}
                  onChange={(event) =>
                    patch({ max_cert_bytes: Number(event.target.value) })
                  }
                  type="number"
                  value={config.max_cert_bytes}
                />
              </Field>
            </div>
          </div>
          <div>
            <Label>{t("switch.servers", "Servers")}</Label>
            <p className="mb-2 text-muted-foreground text-xs">
              {t(
                "switch.serversHint",
                "Leave every box clear to include every VLESS Reality server. Region and ASN come from each checked server, not from the panel."
              )}
            </p>
            <div className="max-h-56 space-y-2 overflow-auto rounded-lg border p-3">
              {(servers.data ?? []).map((server) => (
                <div
                  className="flex items-center gap-2 text-sm"
                  key={server.id}
                >
                  <Checkbox
                    checked={config.server_ids.includes(server.id)}
                    id={`reality-scan-server-${server.id}`}
                    onCheckedChange={(checked) =>
                      toggleServer(server.id, checked === true)
                    }
                  />
                  <Label
                    className="font-medium"
                    htmlFor={`reality-scan-server-${server.id}`}
                  >
                    {server.name}
                  </Label>
                  <span className="text-muted-foreground">
                    {server.address}
                  </span>
                </div>
              ))}
              {(servers.data ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("switch.noServers", "No servers yet")}
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("results.title", "Latest usable targets")}</CardTitle>
          <CardDescription>
            {t("results.scanned", {
              count: report?.scanned ?? 0,
              defaultValue: "{{count}} targets probed",
            })}
            {report?.truncated
              ? t("results.truncated", " The list was cut at the scan cap.")
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("results.score", "Score")}</TableHead>
                <TableHead>{t("results.target", "Target")}</TableHead>
                <TableHead>{t("results.certificate", "Certificate")}</TableHead>
                <TableHead>{t("results.latency", "Latency")}</TableHead>
                <TableHead>{t("results.source", "Source")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.results ?? []).map((item) => (
                <TableRow key={`${item.dial_host}-${item.port}-${item.source}`}>
                  <TableCell className="font-medium">{item.score}</TableCell>
                  <TableCell>
                    <div>{item.cert_domain || item.dial_host}</div>
                    <div className="text-muted-foreground text-xs">
                      {item.ip || item.dial_host}:{item.port} · {item.tls} ·{" "}
                      {item.alpn} · {item.curve}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{item.cert_issuer || "—"}</div>
                    <div className="text-muted-foreground text-xs">
                      {item.cert_bytes ?? 0} B
                    </div>
                  </TableCell>
                  <TableCell>{item.latency_ms ?? "—"} ms</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.source}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(report?.results ?? []).length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={5}>
                    {t("results.empty", "No scan yet")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("changes.title", "Switch log")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("changes.server", "Server")}</TableHead>
                <TableHead>{t("changes.protocol", "Protocol")}</TableHead>
                <TableHead>{t("changes.from", "From")}</TableHead>
                <TableHead>{t("changes.to", "To")}</TableHead>
                <TableHead>{t("changes.reason", "Result")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.switches ?? []).map((item) => (
                <TableRow
                  key={`${item.server_id}-${item.protocol}-${item.reason}`}
                >
                  <TableCell>{item.server_name}</TableCell>
                  <TableCell>{item.protocol}</TableCell>
                  <TableCell>
                    {item.from_sni || "—"}
                    <div className="text-muted-foreground text-xs">
                      {item.from_addr}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.to_sni || "—"}
                    <div className="text-muted-foreground text-xs">
                      {item.to_addr
                        ? `${item.to_addr}:${item.to_port ?? ""}`
                        : ""}
                    </div>
                  </TableCell>
                  <TableCell>{reasons[item.reason] ?? item.reason}</TableCell>
                </TableRow>
              ))}
              {(report?.switches ?? []).length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={5}>
                    {report?.applied
                      ? t("changes.none", "Nothing needed a change")
                      : t(
                          "changes.notApplied",
                          "This run recorded targets and did not change servers"
                        )}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
