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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { getServerList } from "@workspace/ui/services/admin/admin";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  getRealityScan,
  type RealityScanConfig,
  type RealityScanGeoStatus,
  type RealityScanResult,
  type RealityScanServerConfig,
  type RealityScanSwitch,
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
  servers: [],
  threads: 8,
  timeout_seconds: 5,
  max_cert_bytes: 8192,
  geoip_download: false,
  geoip_city_url: "",
  geoip_city_sha256: "",
  geoip_asn_url: "",
  geoip_asn_sha256: "",
};

function formatWhen(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function isVlessReality(server: API.Server) {
  return (server.protocols ?? []).some(
    (protocol) =>
      protocol.enable &&
      protocol.type?.toLowerCase() === "vless" &&
      protocol.security?.toLowerCase() === "reality"
  );
}

function serverPolicy(
  config: RealityScanConfig,
  id: number
): RealityScanServerConfig {
  return (
    config.servers.find((item) => item.server_id === id) ?? {
      server_id: id,
      enabled: false,
      auto_switch: false,
      score_margin: config.score_margin,
      cooldown_hours: config.cooldown_hours,
    }
  );
}

export default function RealityScan() {
  const { t } = useTranslation("reality-scan");
  const [config, setConfig] = useState<RealityScanConfig>(emptyConfig);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [geoip, setGeoip] = useState<RealityScanGeoStatus>();

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
  const vless = useMemo(
    () => (servers.data ?? []).filter(isVlessReality),
    [servers.data]
  );

  useEffect(() => {
    if (hydrated || !scan.data?.config) return;
    setConfig({
      ...emptyConfig,
      ...scan.data.config,
      servers: scan.data.config.servers ?? [],
    });
    setHydrated(true);
    setGeoip(scan.data.geoip);
  }, [hydrated, scan.data]);

  useEffect(() => {
    if (!hydrated) return;
    setConfig((current) => {
      const known = new Map(
        current.servers.map((item) => [item.server_id, item])
      );
      const next = vless.map(
        (server) =>
          known.get(server.id) ?? {
            server_id: server.id,
            enabled: false,
            auto_switch: false,
            score_margin: current.score_margin || 400,
            cooldown_hours: current.cooldown_hours || 12,
          }
      );
      if (
        next.length === current.servers.length &&
        next.every((item, index) => item === current.servers[index])
      ) {
        return current;
      }
      return { ...current, servers: next };
    });
  }, [hydrated, vless]);

  function patch(partial: Partial<RealityScanConfig>) {
    setConfig((current) => ({ ...current, ...partial }));
  }

  function patchServer(id: number, partial: Partial<RealityScanServerConfig>) {
    setConfig((current) => ({
      ...current,
      servers: current.servers.map((item) =>
        item.server_id === id ? { ...item, ...partial } : item
      ),
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const view = await updateRealityScan({
        ...config,
        servers: config.servers.filter((item) =>
          vless.some((server) => server.id === item.server_id)
        ),
        server_ids: config.servers
          .filter((item) => item.enabled)
          .map((item) => item.server_id),
      });
      applyView(view);
      if (view.geoip?.error) {
        toast.error(view.geoip.error);
      } else {
        toast.success(t("saved", "Saved"));
      }
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
    setConfig({
      ...emptyConfig,
      ...view.config,
      servers: view.config.servers ?? [],
    });
    setGeoip(view.geoip);
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
              "Only a VLESS server whose scan switch is on is scanned. Each server uses its own address, /24, ASN and region. Education sites are searched for that region; they are not typed in by hand."
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

      <Tabs defaultValue="global">
        <TabsList className="mb-4 h-auto flex-wrap">
          <TabsTrigger value="global">{t("tabs.global", "Global")}</TabsTrigger>
          {vless.map((server) => (
            <TabsTrigger key={server.id} value={`server-${server.id}`}>
              {server.name}
              {serverPolicy(config, server.id).enabled ? "" : " · off"}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="global">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("schedule.title", "Schedule")}</CardTitle>
                <CardDescription>
                  {t(
                    "schedule.description",
                    "The clock uses the panel time zone. A finished day does not run again. Only servers with their own scan switch on are included."
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
                    onChange={(event) =>
                      patch({ daily_time: event.target.value })
                    }
                    type="time"
                    value={config.daily_time}
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("global.servers", "VLESS servers")}</CardTitle>
                <CardDescription>
                  {t(
                    "global.serversHint",
                    "Turn a server on to scan its /24 and, when needed, education sites in its region. A server that is off is skipped."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {vless.map((server) => {
                  const policy = serverPolicy(config, server.id);
                  return (
                    <div
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      key={server.id}
                    >
                      <div>
                        <div className="font-medium">{server.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {server.address}
                          {server.country || server.city
                            ? ` · ${[server.country, server.city].filter(Boolean).join(" / ")}`
                            : ""}
                        </div>
                      </div>
                      <Switch
                        checked={policy.enabled}
                        onCheckedChange={(enabled) =>
                          patchServer(server.id, { enabled })
                        }
                      />
                    </div>
                  );
                })}
                {vless.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {t("switch.noServers", "No VLESS Reality servers yet")}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>{t("geoip.title", "IP geolocation")}</CardTitle>
                <CardDescription>
                  {t(
                    "geoip.description",
                    "The City database gives the server's country and region. The ASN database gives the network, which is how CDN edges are told apart from the VLESS server. Leave a URL blank to use the built-in mirror. A download is accepted only when it is a real GeoLite2-City or GeoLite2-ASN database. SHA256 is an optional pin."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Toggle
                  checked={config.geoip_download}
                  label={t(
                    "geoip.download",
                    "Allow download and verification of the databases"
                  )}
                  onChange={(geoip_download) => patch({ geoip_download })}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={t("geoip.cityUrl", "City database URL")}>
                    <Input
                      onChange={(event) =>
                        patch({ geoip_city_url: event.target.value })
                      }
                      placeholder="https://"
                      value={config.geoip_city_url}
                    />
                  </Field>
                  <Field label={t("geoip.citySha", "City SHA256")}>
                    <Input
                      onChange={(event) =>
                        patch({ geoip_city_sha256: event.target.value })
                      }
                      spellCheck={false}
                      value={config.geoip_city_sha256}
                    />
                  </Field>
                  <Field label={t("geoip.asnUrl", "ASN database URL")}>
                    <Input
                      onChange={(event) =>
                        patch({ geoip_asn_url: event.target.value })
                      }
                      placeholder="https://"
                      value={config.geoip_asn_url}
                    />
                  </Field>
                  <Field label={t("geoip.asnSha", "ASN SHA256")}>
                    <Input
                      onChange={(event) =>
                        patch({ geoip_asn_sha256: event.target.value })
                      }
                      spellCheck={false}
                      value={config.geoip_asn_sha256}
                    />
                  </Field>
                </div>
                <p className="text-muted-foreground text-sm">
                  {t("geoip.cityStatus", "City database")}:{" "}
                  {geoip?.city_ready
                    ? t("geoip.ready", "ready")
                    : t("geoip.missing", "not ready")}
                  {" · "}
                  {t("geoip.asnStatus", "ASN database")}:{" "}
                  {geoip?.asn_ready
                    ? t("geoip.ready", "ready")
                    : t("geoip.missing", "not ready")}
                </p>
                {geoip?.error ? (
                  <p className="text-destructive text-sm">{geoip.error}</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {vless.map((server) => {
          const policy = serverPolicy(config, server.id);
          const results = (report?.results ?? []).filter((item) =>
            item.server_ids?.includes(server.id)
          );
          const switches = (report?.switches ?? []).filter(
            (item) => item.server_id === server.id
          );
          const edu = (report?.edu_searches ?? []).find(
            (item) => item.server_id === server.id
          );
          return (
            <TabsContent key={server.id} value={`server-${server.id}`}>
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{server.name}</CardTitle>
                    <CardDescription>
                      {server.address}
                      {server.country || server.city
                        ? ` · ${[server.country, server.city].filter(Boolean).join(" / ")}`
                        : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Toggle
                      checked={policy.enabled}
                      label={t("server.scan", "Scan this server")}
                      onChange={(enabled) =>
                        patchServer(server.id, { enabled })
                      }
                    />
                    <Toggle
                      checked={policy.auto_switch}
                      label={t("server.apply", "Apply the winning target")}
                      onChange={(auto_switch) =>
                        patchServer(server.id, { auto_switch })
                      }
                    />
                    <Field label={t("switch.margin", "Score margin")}>
                      <Input
                        min={0}
                        onChange={(event) =>
                          patchServer(server.id, {
                            score_margin: Number(event.target.value),
                          })
                        }
                        type="number"
                        value={policy.score_margin}
                      />
                    </Field>
                    <Field label={t("switch.cooldown", "Cooldown, hours")}>
                      <Input
                        min={1}
                        onChange={(event) =>
                          patchServer(server.id, {
                            cooldown_hours: Number(event.target.value),
                          })
                        }
                        type="number"
                        value={policy.cooldown_hours}
                      />
                    </Field>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t("server.edu", "Education search")}</CardTitle>
                    <CardDescription>
                      {edu?.query ||
                        t(
                          "server.eduHint",
                          "If this server's /24 has no match, the scan searches the web for education sites in its region and tests them."
                        )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {edu?.error ? (
                      <p className="mb-2 text-destructive text-sm">
                        {edu.error}
                      </p>
                    ) : null}
                    {(edu?.domains ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {edu?.domains.map((domain) => (
                          <Badge key={domain} variant="secondary">
                            {domain}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {t(
                          "server.eduEmpty",
                          "No education search for this server yet."
                        )}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <ResultTable
                  empty={t("results.empty", "No scan yet")}
                  results={results}
                  title={t("results.title", "Latest usable targets")}
                />
                <SwitchTable
                  empty={
                    policy.auto_switch
                      ? t("changes.none", "Nothing needed a change")
                      : t(
                          "changes.notApplied",
                          "This server records targets and does not change its protocol until apply is on."
                        )
                  }
                  reasons={reasons}
                  switches={switches}
                  title={t("changes.title", "Switch log")}
                />
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function ResultTable({
  title,
  results,
  empty,
}: {
  title: string;
  results: RealityScanResult[];
  empty: string;
}) {
  const { t } = useTranslation("reality-scan");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
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
            {results.map((item) => (
              <TableRow key={`${item.dial_host}-${item.port}-${item.source}`}>
                <TableCell className="font-medium">{item.score}</TableCell>
                <TableCell>
                  <div>{item.cert_domain || item.dial_host}</div>
                  <div className="text-muted-foreground text-xs">
                    {item.ip || item.dial_host}:{item.port} · {item.tls} ·{" "}
                    {item.alpn}
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
            {results.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={5}>
                  {empty}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SwitchTable({
  title,
  switches,
  reasons,
  empty,
}: {
  title: string;
  switches: RealityScanSwitch[];
  reasons: Record<string, string>;
  empty: string;
}) {
  const { t } = useTranslation("reality-scan");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("changes.protocol", "Protocol")}</TableHead>
              <TableHead>{t("changes.from", "From")}</TableHead>
              <TableHead>{t("changes.to", "To")}</TableHead>
              <TableHead>{t("changes.reason", "Result")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {switches.map((item) => (
              <TableRow
                key={`${item.protocol}-${item.reason}-${item.from_addr}`}
              >
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
            {switches.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={4}>
                  {empty}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
