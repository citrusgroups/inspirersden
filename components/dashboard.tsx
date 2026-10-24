"use client";
/* Supplied brand assets use their original files. */
/* eslint-disable @next/next/no-img-element */
/* Auth and dispatch-owned logout need a full document navigation to refresh HTTP-only sessions. */
/* eslint-disable @next/next/no-location-assign-relative-destination */
import { readJson, type JsonObject } from "@/lib/json";
import AgentInbox from "@/components/agent-inbox";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ComponentProps,
} from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { usePathname } from "next/navigation";
import QRCode from "qrcode";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Link2,
  Package,
  FileText,
  Megaphone,
  MousePointerClick,
  Contact,
  UserCog,
  ChartNoAxesCombined,
  History,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Plus,
  Download,
  Copy,
  X,
  Menu,
  LogOut,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Check,
  Camera as Instagram,
  SquareUserRound as Facebook,
  Music2,
  Mail,
  Calendar,
  Grip,
  List,
  SlidersHorizontal,
  Upload,
  ShieldCheck,
  Archive,
  CheckCircle2,
  AlertCircle,
  Ellipsis,
  Save,
  Trash2,
  Bot,
} from "lucide-react";
import type { State, Entry, Data, Member, Field, FileInfo } from "@/lib/types";
import {
  navigation,
  slugs,
  definitions,
  stages,
  platforms,
  categories,
} from "@/lib/types";
const navIcons: Record<string, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  influencers: Users,
  leads: Inbox,
  "agent-inbox": Bot,
  social: Link2,
  packages: Package,
  "media-kits": FileText,
  campaigns: Megaphone,
  tracking: MousePointerClick,
  contacts: Contact,
  team: UserCog,
  reports: ChartNoAxesCombined,
  activity: History,
  settings: Settings,
};
const navGroups = [
  {
    label: "Workspace",
    slugs: ["overview", "influencers", "leads", "agent-inbox"],
  },
  {
    label: "Operations",
    slugs: ["social", "packages", "media-kits", "campaigns", "tracking"],
  },
  {
    label: "Administration",
    slugs: ["contacts", "team", "reports", "activity", "settings"],
  },
];
const platformIcons: Record<string, typeof Instagram> = {
  Instagram,
  Facebook,
  TikTok: Music2,
  Gmail: Mail,
};
const compact = (n: number) =>
  Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
const money = (n: unknown, c: unknown = "PKR") =>
  String(c) + " " + Number(n || 0).toLocaleString();
const date = (s: string) =>
  s
    ? new Date(s).toLocaleDateString("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
const val = (e: Entry, k: string) => String(e.data[k] || "");
async function api<T = JsonObject>(path: string, data?: unknown): Promise<T> {
  const r = await fetch(
    "/api/" + path,
    data
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : {},
  );
  if (r.status === 401 && path !== "auth/refresh") {
    const refreshed = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (refreshed.ok) return api<T>(path, data);
  }
  const d = await readJson(r);
  if (!r.ok) throw new Error(d.error || "Could not complete this action.");
  return d as T;
}
function Badge({ children }: { children: React.ReactNode }) {
  const str = String(children);
  const cls = ["Active", "Confirmed", "Connected", "Paid", "Approved"].includes(
    str,
  )
    ? "good"
    : [
          "Pending",
          "New",
          "Planning",
          "Permission Required",
          "Negotiation",
          "Unpaid",
        ].includes(str)
      ? "pending"
      : ["Inactive", "Lost", "Connection Error", "Connection Expired"].includes(
            str,
          )
        ? "muted"
        : "neutral";
  return <span className={"badge " + cls}>{children}</span>;
}
function Avatar({ entry, size = "" }: { entry: Entry; size?: string }) {
  return entry.data.image ? (
    <img
      className={"avatar " + size}
      src={String(entry.data.image)}
      alt=""
      onError={(event) => {
        event.currentTarget.src = "/brand/plans.jpg";
      }}
    />
  ) : (
    <span className={"avatar initials " + size}>
      {val(entry, "name").slice(0, 2).toUpperCase()}
    </span>
  );
}
function Empty({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox />
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
  variant = "default",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  variant?: "default" | "form" | "detail" | "danger";
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className={`agency-dialog ${wide ? "wide" : ""} ${variant}`}
      >
        <header>
          <DialogTitle>{title}</DialogTitle>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
function Choice({
  children,
  value,
  defaultValue,
  onChange,
  className,
  id,
  name,
  required,
  disabled,
  "aria-label": label,
}: ComponentProps<"select">) {
  return (
    <select
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      aria-label={label}
      value={value}
      defaultValue={value === undefined ? defaultValue : undefined}
      onChange={onChange}
      className={"agency-choice " + (className || "")}
    >
      {children}
    </select>
  );
}
function DashboardSkeleton() {
  return (
    <div
      className="workspace dashboard-skeleton"
      aria-label="Loading workspace"
    >
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/brand/logo.png" alt="" />
          <span>
            INSPIRERS’ DEN<small>AGENCY WORKSPACE</small>
          </span>
        </div>
        <div className="skeleton sidebar-skeleton-label" />
        <nav>
          {navigation.slice(0, 9).map((name) => (
            <div className="skeleton sidebar-skeleton-link" key={name} />
          ))}
        </nav>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="skeleton skeleton-breadcrumb" />
          <div className="skeleton skeleton-account" />
        </header>
        <main className="dashboard-content">
          <div className="skeleton skeleton-eyebrow" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-copy" />
          <div className="metrics-grid skeleton-metrics">
            {[1, 2, 3, 4].map((item) => (
              <div className="metric-card" key={item}>
                <div className="skeleton skeleton-card-label" />
                <div className="skeleton skeleton-card-value" />
                <div className="skeleton skeleton-card-note" />
              </div>
            ))}
          </div>
          <div className="overview-grid">
            <section className="panel skeleton-panel">
              <div className="skeleton skeleton-panel-title" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
            </section>
            <section className="panel skeleton-panel">
              <div className="skeleton skeleton-panel-title" />
              <div className="skeleton skeleton-row" />
              <div className="skeleton skeleton-row" />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
export default function Dashboard() {
  const pathname = usePathname();
  const section = pathname.split("/")[2] || "overview";
  const index = Math.max(0, slugs.indexOf(section));
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [toast, setToast] = useState(""),
    [sidebar, setSidebar] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("All statuses"),
    [category, setCategory] = useState("All categories"),
    [platform, setPlatform] = useState("All platforms"),
    [location, setLocation] = useState(""),
    [sort, setSort] = useState("updated"),
    [view, setView] = useState("table"),
    [page, setPage] = useState(1),
    [range, setRange] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [editing, setEditing] = useState<{ kind: string; entry?: Entry } | null>(
      null,
    ),
    [selected, setSelected] = useState<Entry | null>(null),
    [deleteTarget, setDeleteTarget] = useState<Entry | null>(null),
    [fileDeleteTarget, setFileDeleteTarget] = useState<{
      file: FileInfo;
      record: Entry;
    } | null>(null),
    [invite, setInvite] = useState<Entry | boolean | null>(null),
    [notification, setNotification] = useState(false),
    [profile, setProfile] = useState(false),
    [settingsTab, setSettingsTab] = useState("Agency profile"),
    [uploadRecord, setUploadRecord] = useState<Entry | null>(null),
    [connecting, setConnecting] = useState("");
  const notify = useCallback((m: string) => {
    setToast(m);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const load = useCallback(async () => {
    try {
      const result = await api<State>("state");
      setState(result);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
    const status = new URLSearchParams(window.location.search).get(
      "connection",
    );
    if (status)
      queueMicrotask(() =>
        notify(
          status === "Connected" ? "Account connected successfully." : status,
        ),
      );
  }, [load, notify]);
  useEffect(() => {
    queueMicrotask(() => {
      setQuery("");
      setStatus("All statuses");
      setCategory("All categories");
      setPlatform("All platforms");
      setLocation("");
      setView(
        section === "campaigns" || section === "packages" ? "cards" : "table",
      );
      setPage(1);
      setSidebar(false);
    });
  }, [section]);
  useEffect(() => {
    queueMicrotask(() => setPage(1));
  }, [query, status, category, platform, location, sort, range, from, to]);
  const inRange = useCallback(
    (s: string) => {
      if (range === "all") return true;
      const start =
        range === "custom"
          ? from
          : new Date(Date.now() - Number(range) * 86400000)
              .toISOString()
              .slice(0, 10);
      const end = range === "custom" ? to : "";
      return (
        (!start || s.slice(0, 10) >= start) && (!end || s.slice(0, 10) <= end)
      );
    },
    [range, from, to],
  );
  const creators = useMemo(
    () => state?.records.filter((r) => r.kind === "influencer") || [],
    [state],
  );
  const leads =
    state?.records.filter((r) => r.kind === "lead" && inRange(r.created)) || [];
  const campaigns =
    state?.records.filter((r) => r.kind === "campaign" && inRange(r.created)) ||
    [];
  const packages = state?.records.filter((r) => r.kind === "package") || [];
  const clicks = state?.clicks.filter((c) => inRange(c.created)) || [];
  const kind: Record<string, string> = {
    influencers: "influencer",
    leads: "lead",
    packages: "package",
    campaigns: "campaign",
    contacts: "contact",
  };
  const entries = (state?.records.filter((r) => r.kind === kind[section]) || [])
    .filter(
      (r) =>
        (!query ||
          JSON.stringify(r.data).toLowerCase().includes(query.toLowerCase()) ||
          r.id.toLowerCase().includes(query.toLowerCase())) &&
        (status === "All statuses" || r.data.status === status) &&
        (category === "All categories" || r.data.niche === category) &&
        (platform === "All platforms" || r.data.platform === platform) &&
        (!location ||
          val(r, "location").toLowerCase().includes(location.toLowerCase())) &&
        (r.kind === "influencer" || r.kind === "package" || inRange(r.created)),
    )
    .sort((a, b) =>
      sort === "name"
        ? val(a, "name").localeCompare(val(b, "name"))
        : sort === "followers"
          ? Number(b.data.followers || 0) - Number(a.data.followers || 0)
          : sort === "budget"
            ? Number(b.data.budget || b.data.price || 0) -
              Number(a.data.budget || a.data.price || 0)
            : b.updated.localeCompare(a.updated),
    );
  const isAdmin = state
    ? ["Agency Owner", "Admin"].includes(state.user.role)
    : false;
  const isStaff = state
    ? ["Agency Owner", "Admin", "Manager"].includes(state.user.role)
    : false;
  const writable = (e: Entry) =>
    isAdmin ||
    (state?.user.role === "Manager" && e.data.assigned === state.user.email) ||
    (state?.user.role === "Influencer" && e.id === state.user.influencer_id);
  async function save(kind: string, data: Data, entry?: Entry, photo?: File) {
    try {
      const result = await api("records" + (entry ? "/" + entry.id : ""), {
        kind,
        data,
        version: entry?.version,
      });
      if (kind === "influencer" && photo) {
        const form = new FormData();
        form.set("recordId", result.record.id);
        form.set("purpose", "avatar");
        form.set("file", photo);
        const response = await fetch("/api/upload", {
          method: "POST",
          body: form,
        });
        const uploaded = await readJson(response);
        if (!response.ok)
          throw new Error(
            uploaded.error || "Profile photo could not be uploaded.",
          );
      }
      await load();
      setEditing(null);
      notify(
        entry
          ? "Changes saved."
          : kind === "influencer"
            ? "Influencer profile created."
            : "Record created.",
      );
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  }
  async function archive(e: Entry) {
    const data = {
      ...e.data,
      status: e.data.status === "Inactive" ? "Active" : "Inactive",
    };
    await save(e.kind, data, e);
    setSelected(null);
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("Link copied to clipboard.");
    } catch {
      notify(
        "Copy is unavailable in this browser. Select the displayed link manually.",
      );
    }
  }
  async function connectTarget(
    targetId: string,
    p: string,
    disconnect = false,
  ) {
    setConnecting(targetId + p);
    try {
      const result = await api(
        "oauth/" +
          p.toLowerCase() +
          "/" +
          (disconnect ? "disconnect" : "start"),
        { influencerId: targetId },
      );
      if (result.url) window.location.assign(result.url);
      else {
        await load();
        notify("Account disconnected.");
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setConnecting("");
    }
  }
  async function connect(e: Entry, p: string, disconnect = false) {
    return connectTarget(e.id, p, disconnect);
  }
  function exportCsv(rows: Record<string, unknown>[], filename: string) {
    if (!rows.length) {
      notify("No records in the selected range.");
      return;
    }
    const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const cell = (v: unknown) => {
      let s = Array.isArray(v) ? v.join(" | ") : String(v ?? "");
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const csv =
      "\ufeff" +
      [
        keys.map(cell).join(","),
        ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
      ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    notify("CSV exported.");
  }
  function exportTracking() {
    exportCsv(
      creators.map((c) => {
        const l = leads.filter(
          (l) => l.data.influencerId === c.id || l.data.reference === c.id,
        );
        const won = l.filter((l) => l.data.status === "Confirmed");
        return {
          id: c.id,
          name: c.data.name,
          clicks: clicks.filter((x) => x.influencer_id === c.id).length,
          leads: l.length,
          conversions: won.length,
          conversionRate: l.length
            ? ((won.length / l.length) * 100).toFixed(1) + "%"
            : "0%",
          trackedLink: tracked(c),
          dateFrom: from,
          dateTo: to,
        };
      }),
      "inspirers-tracking.csv",
    );
  }
  const tracked = (e: Entry) =>
    typeof window === "undefined"
      ? ""
      : window.location.origin + "/go/" + e.slug;
  useEffect(() => {
    const doc = document as Document & {
      modelContext?: {
        registerTool: (tool: unknown, options: unknown) => void;
      };
    };
    if (!doc.modelContext || section !== "influencers") return;
    const lifecycle = new AbortController();
    try {
      doc.modelContext.registerTool(
        {
          name: "search_influencers",
          description:
            "Filter the visible influencer list by name, handle or category.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: (input: unknown) => {
            const q = (input as { query?: unknown }).query;
            if (typeof q !== "string" || q.length > 200)
              throw new Error("query must be a string up to 200 characters");
            setQuery(q);
            return {
              count: creators.filter((r) =>
                JSON.stringify(r.data).toLowerCase().includes(q.toLowerCase()),
              ).length,
            };
          },
        },
        { signal: lifecycle.signal },
      );
    } catch {}
    return () => lifecycle.abort();
  }, [creators, section]);
  if (loading) return <DashboardSkeleton />;
  if (!state)
    return (
      <div className="workspace-loading">
        <AlertCircle />
        <h2>Workspace unavailable</h2>
        <p>{error}</p>
        <button className="btn charcoal" onClick={load}>
          Try again
        </button>
        <Link href="/auth/login">Sign in</Link>
      </div>
    );
  const title = navigation[index];
  const connected = state.connections.filter(
    (c) => c.status === "Connected",
  ).length;
  const descriptions: Record<string, string> = {
    overview: "A clear view of your creators, collaborations and next steps.",
    influencers: "The voices that make your network.",
    leads: "Every conversation, from first hello to confirmed collaboration.",
    "agent-inbox": "Review AI conversations, approvals and human handoffs.",
    social: "Manage agency and creator account access securely.",
    packages: "Clear deliverables. Consistent offers.",
    campaigns: "Bring every collaboration together.",
    tracking: "Follow the connections your creators generate.",
    "media-kits": "Creator portfolios and collaboration details.",
    contacts: "Your agency’s address book.",
    team: "The people behind the work.",
    reports: "Turn saved activity into useful insight.",
    activity: "A record of the work happening across the agency.",
    settings: "Make the workspace your own.",
  };
  const dateControl = (
    <div className="date-control">
      <Calendar size={16} />
      <Choice
        aria-label="Date range"
        value={range}
        onChange={(e) => setRange(e.target.value)}
      >
        <option value="all">All time</option>
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="custom">Custom range</option>
      </Choice>
      {range === "custom" && (
        <>
          <input
            type="date"
            aria-label="Start date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            aria-label="End date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </>
      )}
    </div>
  );
  const addButton =
    kind[section] && isStaff && (section !== "packages" || isAdmin) ? (
      <button
        className="btn gold"
        onClick={() => setEditing({ kind: kind[section] })}
      >
        <Plus size={17} />
        Add {kind[section]}
      </button>
    ) : null;
  function rowTable(list: Entry[], short = false) {
    return (
      <div className="table-scroll">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {section === "leads"
                  ? "Brand / contact"
                  : section === "campaigns"
                    ? "Campaign"
                    : section === "packages"
                      ? "Package"
                      : "Name"}
              </TableHead>
              <TableHead>
                {short || section === "influencers"
                  ? "Category"
                  : section === "leads"
                    ? "Source"
                    : section === "campaigns"
                      ? "Brand"
                      : section === "packages"
                        ? "Deliverables"
                        : "Email"}
              </TableHead>
              <TableHead>
                {short || section === "influencers"
                  ? "Audience"
                  : section === "leads"
                    ? "Budget"
                    : section === "campaigns"
                      ? "Timeline"
                      : section === "packages"
                        ? "Price"
                        : "Company"}
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <button className="table-name" onClick={() => setSelected(e)}>
                    {e.kind === "influencer" && <Avatar entry={e} />}
                    <span>
                      <b>{e.data.name}</b>
                      <small>
                        {e.kind === "influencer"
                          ? e.data.handle
                          : e.data.contact || e.id}
                      </small>
                    </span>
                  </button>
                </TableCell>
                <TableCell>
                  {e.kind === "influencer" ? (
                    <span className="niche-chip">{e.data.niche}</span>
                  ) : e.kind === "lead" ? (
                    e.data.source
                  ) : e.kind === "campaign" ? (
                    e.data.brand
                  ) : e.kind === "package" ? (
                    <span className="truncate">{e.data.deliverables}</span>
                  ) : (
                    e.data.email
                  )}
                </TableCell>
                <TableCell>
                  {e.kind === "influencer" ? (
                    <>
                      <b>{compact(Number(e.data.followers || 0))}</b>
                      <small className="table-small">kit snapshot</small>
                    </>
                  ) : e.kind === "lead" ? (
                    money(e.data.budget, e.data.currency)
                  ) : e.kind === "campaign" ? (
                    date(val(e, "start"))
                  ) : e.kind === "package" ? (
                    money(e.data.price, e.data.currency)
                  ) : (
                    e.data.company
                  )}
                </TableCell>
                <TableCell>
                  <Badge>{e.data.status || "—"}</Badge>
                </TableCell>
                <TableCell>
                  <button
                    className="icon-button"
                    aria-label={"View " + e.data.name}
                    onClick={() => setSelected(e)}
                  >
                    <Ellipsis size={18} />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
  function socialCard(e: Entry, p: string) {
    const conn = state?.connections.find(
      (c) => c.influencer_id === e.id && c.platform === p,
    );
    const status =
      connecting === e.id + p ? "Connecting" : conn?.status || "Not Connected";
    const P = platformIcons[p] || Link2;
    return (
      <div className="social-card" key={e.id + p}>
        <div className="social-card-top">
          <span className={"platform-icon " + p.toLowerCase()}>
            <P />
          </span>
          <Badge>{status}</Badge>
        </div>
        <h3>{p}</h3>
        {conn?.avatar && (
          <img
            className="connection-avatar"
            src={conn.avatar}
            alt={conn.username + " profile"}
          />
        )}
        <p>{conn?.username || val(e, "name")}</p>
        {conn?.connected && (
          <small>
            Connected {date(conn.connected)}
            <br />
            Last sync {date(conn.synced)}
          </small>
        )}
        <span className="integration-caption">
          {state?.integrationReady[p]
            ? "Official authorization available"
            : "API setup required"}
          {p === "Gmail" ? " · account identity only" : ""}
        </span>
        {writable(e) && (
          <button
            className={"btn " + (status === "Connected" ? "outline" : "soft")}
            disabled={status === "Connecting"}
            onClick={() => connect(e, p, status === "Connected")}
          >
            {status === "Connecting"
              ? "Connecting…"
              : status === "Connected"
                ? "Disconnect"
                : [
                      "Connection Expired",
                      "Connection Error",
                      "Permission Required",
                    ].includes(status)
                  ? "Reconnect"
                  : "Connect " + p}
          </button>
        )}
      </div>
    );
  }
  function agencySocialCard(p: string) {
    const conn = state?.connections.find(
      (c) => c.influencer_id === "agency" && c.platform === p,
    );
    const status =
      connecting === "agency" + p
        ? "Connecting"
        : conn?.status || "Not Connected";
    const P = platformIcons[p] || Link2;
    return (
      <div className="social-card" key={"agency" + p}>
        <div className="social-card-top">
          <span className={"platform-icon " + p.toLowerCase()}>
            <P />
          </span>
          <Badge>{status}</Badge>
        </div>
        <h3>{p}</h3>
        {conn?.avatar && (
          <img
            className="connection-avatar"
            src={conn.avatar}
            alt={conn.username + " profile"}
          />
        )}
        <p>
          {conn?.username || String(state?.settings.name || "Agency account")}
        </p>
        {conn?.connected && (
          <small>
            Connected {date(conn.connected)}
            <br />
            Last sync {date(conn.synced)}
          </small>
        )}
        <span className="integration-caption">
          {state?.integrationReady[p]
            ? "Official authorization available"
            : "API setup required"}
          {p === "Gmail" ? " · account identity only" : ""}
        </span>
        {isAdmin && (
          <button
            className={"btn " + (status === "Connected" ? "outline" : "soft")}
            disabled={status === "Connecting"}
            onClick={() => connectTarget("agency", p, status === "Connected")}
          >
            {status === "Connecting"
              ? "Connecting…"
              : status === "Connected"
                ? "Disconnect"
                : [
                      "Connection Expired",
                      "Connection Error",
                      "Permission Required",
                    ].includes(status)
                  ? "Reconnect"
                  : "Connect " + p}
          </button>
        )}
      </div>
    );
  }
  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)}
      className={"workspace " + (collapsed ? "collapsed" : "")}
    >
      <Sidebar
        collapsible="none"
        className={"sidebar " + (sidebar ? "show" : "")}
      >
        <Link href="/" className="sidebar-brand">
          <img
            src={String(state.settings.logo || "/brand/logo.png")}
            alt="Official Inspirers’ Den logo"
          />
          <span>
            INSPIRERS’ DEN<small>AGENCY WORKSPACE</small>
          </span>
        </Link>
        <nav aria-label="Dashboard navigation">
          {navGroups.map((group) => (
            <div className="sidebar-nav-group" key={group.label}>
              <div className="sidebar-label">{group.label}</div>
              {group.slugs.map((slug) => {
                const i = slugs.indexOf(slug);
                const name = navigation[i];
                const Icon = navIcons[slug] || LayoutDashboard;
                return (
                  <Link
                    key={slug}
                    href={"/dashboard/" + (slug === "overview" ? "" : slug)}
                    className={section === slug ? "active" : ""}
                    title={name}
                  >
                    <Icon size={18} />
                    <span>{name}</span>
                    {slug === "leads" &&
                      leads.filter((l) => l.data.status === "New").length >
                        0 && (
                        <small>
                          {leads.filter((l) => l.data.status === "New").length}
                        </small>
                      )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/">
            View agency website <ExternalLink size={14} />
          </Link>
          <button onClick={() => setCollapsed(!collapsed)}>
            <ChevronLeft size={17} />
            <span>Collapse sidebar</span>
          </button>
          <div className="sidebar-user">
            <span className="user-avatar">
              {state.user.name.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <b>{state.user.name.split("@")[0]}</b>
              <small>{state.user.role}</small>
            </span>
            <button
              aria-label="Sign out"
              onClick={async () => {
                await api("auth/logout", {});
                window.location.assign("/auth/login");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </Sidebar>
      {sidebar && (
        <div className="sidebar-mask" onClick={() => setSidebar(false)} />
      )}
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="breadcrumb">
            <button
              className="icon-button"
              aria-label="Open sidebar"
              onClick={() => {
                setSidebar(!sidebar);
                if (collapsed) setCollapsed(false);
              }}
            >
              <Menu size={19} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <b>{title}</b>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <Search size={16} />
              <input
                aria-label="Global search"
                placeholder="Search workspace…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>/</kbd>
            </label>
            <div className="menu-anchor">
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                onClick={() => setNotification(!notification)}
              >
                <Bell size={19} />
                {state.settings.notifications &&
                  leads.some((l) => l.data.status === "New") && <i />}
              </button>
              {notification && (
                <div className="dropdown">
                  <b>Notifications</b>
                  {!state.settings.notifications ? (
                    <p>Workspace notifications are disabled in Settings.</p>
                  ) : leads.filter((l) => l.data.status === "New").length ? (
                    <Link
                      href="/dashboard/leads"
                      onClick={() => setNotification(false)}
                    >
                      {leads.filter((l) => l.data.status === "New").length} new
                      inquiries to review
                    </Link>
                  ) : (
                    <p>You’re all caught up.</p>
                  )}
                  <Link
                    href="/dashboard/activity"
                    onClick={() => setNotification(false)}
                  >
                    View recent activity
                  </Link>
                </div>
              )}
            </div>
            <div className="menu-anchor">
              <button
                className="profile-trigger"
                aria-label="Account menu"
                onClick={() => setProfile(!profile)}
              >
                <span className="user-avatar">
                  {state.user.name.slice(0, 2).toUpperCase()}
                </span>
                <ChevronDown size={14} />
              </button>
              {profile && (
                <div className="dropdown">
                  <b>{state.user.role}</b>
                  <small>{state.user.email}</small>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => {
                      setProfile(false);
                      setSettingsTab("Account & security");
                    }}
                  >
                    Account settings
                  </Link>
                  <button
                    onClick={async () => {
                      await api("auth/logout", {});
                      window.location.assign("/auth/login");
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main key={section} className="dashboard-content">
          <div className="page-heading">
            <div>
              <div className="dashboard-eyebrow">YOUR AGENCY, CONNECTED</div>
              <h1>
                {section === "overview"
                  ? "Your workspace, at a glance."
                  : title}
              </h1>
              <p>{descriptions[section]}</p>
            </div>
            <div className="heading-actions">
              {[
                "overview",
                "leads",
                "campaigns",
                "tracking",
                "reports",
              ].includes(section) && dateControl}
              {addButton}
              {["tracking", "reports"].includes(section) && (
                <button className="btn outline" onClick={exportTracking}>
                  <Download size={16} />
                  Export CSV
                </button>
              )}
            </div>
          </div>
          {!isStaff && !state.user.influencer_id && (
            <div className="setup-note">
              <ShieldCheck />
              <div>
                <strong>Your account is awaiting an agency invitation.</strong>
                <p>
                  Ask your agency manager for a profile invitation and accept it
                  using this email: {state.user.email}.
                </p>
              </div>
            </div>
          )}
          {error && <div className="form-message error">{error}</div>}
          {query && !kind[section] && section !== "social" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Search results</h2>
                <span>
                  {
                    state.records.filter((r) =>
                      JSON.stringify(r.data)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    ).length
                  }{" "}
                  records
                </span>
              </div>
              {rowTable(
                state.records
                  .filter((r) =>
                    JSON.stringify(r.data)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .slice(0, 10),
              )}
            </section>
          )}
          {section === "overview" && (
            <>
              <div className="metrics-grid">
                {[
                  [
                    Users,
                    "Total influencers",
                    creators.length,
                    creators.filter((c) => c.data.status === "Active").length +
                      " active creators",
                    "influencers",
                  ],
                  [
                    Link2,
                    "Connected accounts",
                    connected,
                    "Across official integrations",
                    "social",
                  ],
                  [
                    Inbox,
                    "New inquiries",
                    leads.filter((l) => l.data.status === "New").length,
                    "Ready for a conversation",
                    "leads",
                  ],
                  [
                    Megaphone,
                    "Active campaigns",
                    campaigns.filter((c) => c.data.status === "Active").length,
                    "Collaborations in progress",
                    "campaigns",
                  ],
                ].map(([Icon, label, value, note, href]) => {
                  const I = Icon as typeof Users;
                  return (
                    <Link
                      href={"/dashboard/" + href}
                      className="metric-card"
                      key={String(label)}
                    >
                      <div>
                        <span>{String(label)}</span>
                        <I size={18} />
                      </div>
                      <strong>{String(value).padStart(2, "0")}</strong>
                      <small>{String(note)}</small>
                    </Link>
                  );
                })}
              </div>
              <div className="overview-grid">
                <section className="panel roster-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Your creator network</h2>
                      <p>Distinct voices. Shared possibilities.</p>
                    </div>
                    <Link href="/dashboard/influencers">View all creators</Link>
                  </div>
                  {creators.length ? (
                    rowTable(creators.slice(0, 4), true)
                  ) : (
                    <Empty
                      title="Your network starts here"
                      copy="Add a creator to build their profile and tracking link."
                    />
                  )}
                </section>
                <section className="network-panel">
                  <span className="eyebrow">CREATIVE CONNECTIONS</span>
                  <h2>
                    A place for
                    <br />
                    every <em>voice.</em>
                  </h2>
                  <div className="network-avatars">
                    {creators.slice(0, 4).map((e) => (
                      <Avatar key={e.id} entry={e} />
                    ))}
                  </div>
                  <p>
                    Keep your creators, their portfolios and every collaboration
                    in sync.
                  </p>
                  {isStaff ? (
                    <button
                      className="btn gold"
                      onClick={() => setEditing({ kind: "influencer" })}
                    >
                      <Plus size={16} />
                      Grow your network
                    </button>
                  ) : (
                    <Link href="/dashboard/influencers" className="btn gold">
                      View your profile
                    </Link>
                  )}
                </section>
              </div>
              <div className="overview-bottom">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Inquiry pipeline</h2>
                    <Link href="/dashboard/leads">Open pipeline</Link>
                  </div>
                  <div className="pipeline-summary">
                    <strong>{leads.length}</strong>
                    <span>inquiries in selected period</span>
                    <Badge>
                      {
                        leads.filter((l) => l.data.status === "Confirmed")
                          .length
                      }{" "}
                      confirmed
                    </Badge>
                  </div>
                  <div className="stage-bars">
                    {stages.slice(0, 5).map((s) => (
                      <div key={s}>
                        <span>{s}</span>
                        <div>
                          <i
                            style={{
                              width:
                                (leads.length
                                  ? (leads.filter((l) => l.data.status === s)
                                      .length /
                                      leads.length) *
                                    100
                                  : 0) + "%",
                            }}
                          />
                        </div>
                        <b>{leads.filter((l) => l.data.status === s).length}</b>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Next on your list</h2>
                    <Calendar size={17} />
                  </div>
                  <div className="quick-stats">
                    <Link href="/dashboard/leads">
                      <span>Pending follow-ups</span>
                      <b>
                        {
                          leads.filter(
                            (l) =>
                              l.data.followup &&
                              !["Confirmed", "Closed", "Lost"].includes(
                                val(l, "status"),
                              ),
                          ).length
                        }
                      </b>
                    </Link>
                    <Link href="/dashboard/leads">
                      <span>Packages sent</span>
                      <b>{leads.filter((l) => l.data.packageSent).length}</b>
                    </Link>
                    <Link href="/dashboard/tracking">
                      <span>WhatsApp link clicks</span>
                      <b>{clicks.length}</b>
                    </Link>
                  </div>
                  <div className="recent-label">RECENT ACTIVITY</div>
                  {state.audit.slice(0, 3).map((a) => (
                    <div className="activity-mini" key={a.id}>
                      <span className="activity-mark">
                        <Check size={13} />
                      </span>
                      <div>
                        <b>{a.action}</b>
                        <small>{date(a.created)}</small>
                      </div>
                    </div>
                  ))}
                  {!state.audit.length && (
                    <p className="muted-copy">
                      Your next workspace update will appear here.
                    </p>
                  )}
                </section>
              </div>
            </>
          )}
          {kind[section] && (
            <section className="panel records-panel">
              <div className="records-toolbar">
                <div className="search-input">
                  <Search size={17} />
                  <input
                    placeholder={"Search " + title.toLowerCase() + "…"}
                    aria-label={"Search " + title}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="record-filters">
                  {section !== "contacts" && (
                    <Choice
                      aria-label="Status filter"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option>All statuses</option>
                      {(
                        definitions[kind[section]].find(
                          (f) => f.key === "status",
                        )?.options || []
                      ).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Choice>
                  )}
                  {["influencers", "packages"].includes(section) && (
                    <Choice
                      aria-label="Category filter"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option>All categories</option>
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Choice>
                  )}
                  <Choice
                    aria-label="Sort records"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="updated">Recently updated</option>
                    <option value="name">Name A–Z</option>
                    {section === "influencers" ? (
                      <option value="followers">Audience size</option>
                    ) : (
                      <option value="budget">Highest budget / price</option>
                    )}
                  </Choice>
                  <div className="view-switch">
                    <button
                      aria-label="Table view"
                      className={view === "table" ? "active" : ""}
                      onClick={() => setView("table")}
                    >
                      <List size={17} />
                    </button>
                    <button
                      aria-label="Card view"
                      className={view === "cards" ? "active" : ""}
                      onClick={() => setView("cards")}
                    >
                      <Grip size={17} />
                    </button>
                    {section === "leads" && (
                      <button
                        aria-label="Kanban view"
                        className={view === "kanban" ? "active" : ""}
                        onClick={() => setView("kanban")}
                      >
                        <LayoutDashboard size={17} />
                      </button>
                    )}
                    {section === "campaigns" && (
                      <button
                        aria-label="Calendar view"
                        className={view === "calendar" ? "active" : ""}
                        onClick={() => setView("calendar")}
                      >
                        <Calendar size={17} />
                      </button>
                    )}
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Export filtered records"
                    onClick={() =>
                      exportCsv(
                        entries.map((r) => ({ id: r.id, ...r.data })),
                        "inspirers-" + section + ".csv",
                      )
                    }
                  >
                    <Download size={17} />
                  </button>
                </div>
              </div>
              {section === "influencers" && (
                <div className="extra-filters">
                  <SlidersHorizontal size={15} />
                  <Choice
                    aria-label="Platform filter"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  >
                    <option>All platforms</option>
                    {platforms.slice(0, 3).map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Choice>
                  <input
                    placeholder="Filter by location"
                    aria-label="Location filter"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                  <span>{entries.length} creators</span>
                </div>
              )}
              {!entries.length ? (
                <Empty
                  title={
                    query || status !== "All statuses"
                      ? "No matching records"
                      : "A fresh start for " + title.toLowerCase()
                  }
                  copy={
                    query
                      ? "Try another search or change the filters."
                      : "Add your first record to bring this section to life."
                  }
                  action={addButton}
                />
              ) : view === "table" ? (
                rowTable(entries.slice((page - 1) * 8, page * 8))
              ) : view === "kanban" ? (
                <div className="kanban">
                  {stages.map((s) => (
                    <div className="kanban-column" key={s}>
                      <h3>
                        {s}
                        <span>
                          {entries.filter((e) => e.data.status === s).length}
                        </span>
                      </h3>
                      {entries
                        .filter((e) => e.data.status === s)
                        .map((e) => (
                          <div key={e.id} className="kanban-card">
                            <button onClick={() => setSelected(e)}>
                              <b>{e.data.name}</b>
                              <small>{e.data.contact}</small>
                              <strong>
                                {money(e.data.budget, e.data.currency)}
                              </strong>
                            </button>
                            {writable(e) && (
                              <Choice
                                aria-label={"Stage for " + e.data.name}
                                value={val(e, "status")}
                                onChange={(ev) =>
                                  save(
                                    "lead",
                                    { ...e.data, status: ev.target.value },
                                    e,
                                  )
                                }
                              >
                                {stages.map((s) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </Choice>
                            )}
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              ) : view === "calendar" ? (
                <div className="calendar-list">
                  {entries
                    .sort((a, b) =>
                      val(a, "start").localeCompare(val(b, "start")),
                    )
                    .map((e) => (
                      <button key={e.id} onClick={() => setSelected(e)}>
                        <span className="calendar-day">
                          {e.data.start
                            ? new Date(String(e.data.start)).getDate()
                            : "—"}
                          <small>
                            {e.data.start
                              ? new Date(
                                  String(e.data.start),
                                ).toLocaleDateString("en", { month: "short" })
                              : "No date"}
                          </small>
                        </span>
                        <span>
                          <b>{e.data.name}</b>
                          <small>
                            {e.data.brand} · {date(val(e, "start"))} –{" "}
                            {date(val(e, "end"))}
                          </small>
                        </span>
                        <Badge>{e.data.status}</Badge>
                      </button>
                    ))}
                </div>
              ) : (
                <div className="dashboard-card-grid">
                  {entries.slice((page - 1) * 8, page * 8).map((e) => (
                    <button
                      className={
                        "entity-card " +
                        (e.kind === "influencer" ? "influencer-entity" : "")
                      }
                      key={e.id}
                      onClick={() => setSelected(e)}
                    >
                      {e.kind === "influencer" && (
                        <img
                          src={String(e.data.image || "/brand/logo.png")}
                          alt={String(e.data.name)}
                        />
                      )}
                      <div className="entity-body">
                        <div>
                          <span className="card-overline">
                            {e.kind === "influencer"
                              ? e.data.niche
                              : e.kind === "package"
                                ? "PACKAGE · V" + e.version
                                : e.data.brand || e.kind}
                          </span>
                          <Badge>{e.data.status || "Saved"}</Badge>
                        </div>
                        <h3>{e.data.name}</h3>
                        <p>
                          {e.data.bio ||
                            e.data.requirement ||
                            e.data.deliverables ||
                            e.data.email}
                        </p>
                        <strong>
                          {e.kind === "influencer"
                            ? compact(Number(e.data.followers || 0)) +
                              " audience · kit snapshot"
                            : money(
                                e.data.price || e.data.budget,
                                e.data.currency,
                              )}
                        </strong>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {entries.length > 0 && !["kanban", "calendar"].includes(view) && (
                <div className="pagination">
                  <span>
                    Showing {Math.min((page - 1) * 8 + 1, entries.length)}–
                    {Math.min(page * 8, entries.length)} of {entries.length}
                  </span>
                  <div>
                    <button
                      disabled={page <= 1}
                      aria-label="Previous page"
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span>Page {page}</span>
                    <button
                      disabled={page * 8 >= entries.length}
                      aria-label="Next page"
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
          {section === "agent-inbox" && (
            <AgentInbox
              influencers={creators}
              packages={packages}
              isAdmin={isAdmin}
              isStaff={isStaff}
            />
          )}
          {section === "social" && (
            <>
              <div className="setup-note">
                <ShieldCheck />
                <div>
                  <strong>Your accounts. Your permission.</strong>
                  <p>
                    Official OAuth authorization only. No social passwords are
                    collected. Gmail connects account identity; inbox access and
                    messaging are outside this phase.
                  </p>
                </div>
              </div>
              {isStaff && (
                <section className="social-group agency-social-group">
                  <div className="social-group-heading">
                    <span className="agency-social-logo">
                      <img
                        src={String(state.settings.logo || "/brand/logo.png")}
                        alt="Agency logo"
                      />
                    </span>
                    <h2>{state.settings.name || "Agency"} accounts</h2>
                    <span>AGENCY</span>
                  </div>
                  <div className="social-grid">
                    {platforms.map(agencySocialCard)}
                  </div>
                </section>
              )}
              {creators
                .filter(
                  (e) =>
                    !query ||
                    val(e, "name").toLowerCase().includes(query.toLowerCase()),
                )
                .map((e) => (
                  <section className="social-group" key={e.id}>
                    <div className="social-group-heading">
                      <Avatar entry={e} />
                      <h2>{e.data.name}</h2>
                      <span>{e.id}</span>
                    </div>
                    <div className="social-grid">
                      {platforms.map((p) => socialCard(e, p))}
                    </div>
                  </section>
                ))}
              {!creators.length && (
                <Empty
                  title="No creator accounts yet"
                  copy="An influencer profile is needed before connecting an account."
                />
              )}
            </>
          )}
          {section === "media-kits" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Creator media library</h2>
                  <p>Supplied portfolios and uploaded files.</p>
                </div>
              </div>
              <div className="media-grid">
                {creators.map((e) => (
                  <article className="media-card" key={e.id}>
                    <div>
                      <Avatar entry={e} />
                      <span>
                        <h3>{e.data.name}</h3>
                        <small>{e.id}</small>
                      </span>
                    </div>
                    <div className="media-paper">
                      <FileText size={42} />
                      <b>
                        {e.data.kit
                          ? "Supplied creator media kit"
                          : "No media kit uploaded"}
                      </b>
                      <small>
                        {e.data.kit
                          ? String(e.data.kit).endsWith(".pdf")
                            ? "PDF document"
                            : "Image document"
                          : "PDF and images supported"}
                      </small>
                    </div>
                    <div className="media-actions">
                      {e.data.kit && (
                        <>
                          <a
                            className="btn outline"
                            href={String(e.data.kit)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Preview
                          </a>
                          <a
                            className="icon-button"
                            href={String(e.data.kit)}
                            download
                            aria-label={"Download " + e.data.name + " kit"}
                          >
                            <Download size={17} />
                          </a>
                        </>
                      )}
                      {writable(e) && (
                        <button
                          className="icon-button"
                          aria-label={"Upload kit for " + e.data.name}
                          onClick={() => setUploadRecord(e)}
                        >
                          <Upload size={17} />
                        </button>
                      )}
                    </div>
                    {state.files
                      .filter((f) => f.record_id === e.id)
                      .map((f) => (
                        <div
                          className="attachment-link media-file-row"
                          key={f.id}
                        >
                          <a
                            href={"/api/file/" + f.id}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FileText size={14} />
                            {f.name}
                            <small>{Math.round(f.size / 1024)} KB</small>
                          </a>
                          {writable(e) && (
                            <button
                              className="icon-button delete-file-button"
                              aria-label={"Delete " + f.name}
                              onClick={() =>
                                setFileDeleteTarget({ file: f, record: e })
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                  </article>
                ))}
              </div>
            </section>
          )}
          {["tracking", "reports"].includes(section) && (
            <>
              <div className="metrics-grid">
                {[
                  ["WhatsApp clicks", clicks.length],
                  [
                    "Attributed inquiries",
                    leads.filter((l) => l.data.influencerId || l.data.reference)
                      .length,
                  ],
                  [
                    "Confirmed leads",
                    leads.filter((l) => l.data.status === "Confirmed").length,
                  ],
                  [
                    "Lead conversion",
                    leads.length
                      ? Math.round(
                          (leads.filter((l) => l.data.status === "Confirmed")
                            .length /
                            leads.length) *
                            100,
                        ) + "%"
                      : "0%",
                  ],
                ].map(([l, v]) => (
                  <div className="metric-card" key={l}>
                    <span>{l}</span>
                    <strong>{v}</strong>
                    <small>Selected date range</small>
                  </div>
                ))}
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Performance by creator</h2>
                  <span>Conversions use confirmed leads</span>
                </div>
                <div className="table-scroll">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Influencer</TableHead>
                        <TableHead>Clicks</TableHead>
                        <TableHead>Inquiries</TableHead>
                        <TableHead>Conversions</TableHead>
                        <TableHead>Conversion rate</TableHead>
                        <TableHead>Tracked link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creators.map((c) => {
                        const ls = leads.filter(
                          (l) =>
                            l.data.influencerId === c.id ||
                            l.data.reference === c.id,
                        );
                        const wins = ls.filter(
                          (l) => l.data.status === "Confirmed",
                        ).length;
                        return (
                          <TableRow key={c.id}>
                            <TableCell>
                              <button
                                className="table-name"
                                onClick={() => setSelected(c)}
                              >
                                <Avatar entry={c} />
                                <b>{c.data.name}</b>
                              </button>
                            </TableCell>
                            <TableCell>
                              {
                                clicks.filter((x) => x.influencer_id === c.id)
                                  .length
                              }
                            </TableCell>
                            <TableCell>{ls.length}</TableCell>
                            <TableCell>{wins}</TableCell>
                            <TableCell>
                              {ls.length
                                ? ((wins / ls.length) * 100).toFixed(1)
                                : 0}
                              %
                            </TableCell>
                            <TableCell>
                              <button
                                className="btn soft small"
                                onClick={() => copy(tracked(c))}
                              >
                                <Copy size={14} />
                                Copy link
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </section>
              <div className="overview-bottom">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Leads by platform</h2>
                  </div>
                  <div className="stage-bars">
                    {Array.from(
                      new Set(leads.map((l) => val(l, "platform") || "Other")),
                    ).map((p) => (
                      <div key={p}>
                        <span>{p}</span>
                        <div>
                          <i
                            style={{
                              width:
                                (100 *
                                  leads.filter(
                                    (l) =>
                                      (val(l, "platform") || "Other") === p,
                                  ).length) /
                                  leads.length +
                                "%",
                            }}
                          />
                        </div>
                        <b>
                          {
                            leads.filter(
                              (l) => (val(l, "platform") || "Other") === p,
                            ).length
                          }
                        </b>
                      </div>
                    ))}
                  </div>
                  {!leads.length && (
                    <Empty
                      title="No platform data yet"
                      copy="Record inquiry sources to compare where leads come from."
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Click activity</h2>
                    <button
                      className="icon-button"
                      aria-label="Export click activity"
                      onClick={() => exportCsv(clicks, "inspirers-clicks.csv")}
                    >
                      <Download size={16} />
                    </button>
                  </div>
                  <div className="click-log">
                    {clicks.slice(0, 12).map((c) => (
                      <div key={c.id}>
                        <MousePointerClick size={16} />
                        <span>
                          <b>
                            {creators.find((e) => e.id === c.influencer_id)
                              ?.data.name || c.influencer_id}
                          </b>
                          <small>
                            {c.platform}
                            {c.campaign ? " · " + c.campaign : ""} ·{" "}
                            {new Date(c.created).toLocaleString()}
                          </small>
                        </span>
                      </div>
                    ))}
                  </div>
                  {!clicks.length && (
                    <Empty
                      title="Your first connection is ahead"
                      copy="Share a creator’s tracked WhatsApp link to start measuring clicks."
                    />
                  )}
                </section>
              </div>
            </>
          )}
          {section === "team" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Agency team</h2>
                  <p>Role-based access to your workspace.</p>
                </div>
                {isAdmin && (
                  <button className="btn gold" onClick={() => setInvite(true)}>
                    <Plus size={16} />
                    Invite member
                  </button>
                )}
              </div>
              <div className="table-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Permissions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <b>{m.name}</b>
                          <small className="table-small">{m.email}</small>
                        </TableCell>
                        <TableCell>{m.role}</TableCell>
                        <TableCell>{date(m.created)}</TableCell>
                        <TableCell>
                          <Badge>{m.active ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                        <TableCell>
                          {state.user.role === "Agency Owner" &&
                          m.role !== "Agency Owner" ? (
                            <div className="team-controls">
                              <Choice
                                aria-label={"Role for " + m.email}
                                value={m.role}
                                onChange={async (e) => {
                                  try {
                                    await api("team", {
                                      id: m.id,
                                      role: e.target.value,
                                      active: !!m.active,
                                    });
                                    await load();
                                    notify("Permissions updated.");
                                  } catch (e) {
                                    notify((e as Error).message);
                                  }
                                }}
                              >
                                {["Admin", "Manager", "Influencer"].map((r) => (
                                  <option key={r}>{r}</option>
                                ))}
                              </Choice>
                              <button
                                className="btn outline small"
                                onClick={async () => {
                                  try {
                                    await api("team", {
                                      id: m.id,
                                      role: m.role,
                                      active: !m.active,
                                    });
                                    await load();
                                    notify("Account status updated.");
                                  } catch (e) {
                                    notify((e as Error).message);
                                  }
                                }}
                              >
                                {m.active ? "Deactivate" : "Reactivate"}
                              </button>
                            </div>
                          ) : (
                            <span className="muted-copy">
                              {m.role === "Agency Owner"
                                ? "Full access"
                                : "Managed by owner"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="permission-note">
                <ShieldCheck size={18} />
                <p>
                  <b>Owner & Admin:</b> agency records and invitations.{" "}
                  <b>Manager:</b> assigned creators, leads and campaigns.{" "}
                  <b>Influencer:</b> their profile, assigned campaigns and
                  packages.
                </p>
              </div>
            </section>
          )}
          {section === "activity" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Workspace activity</h2>
                <button
                  className="btn outline small"
                  onClick={() =>
                    exportCsv(
                      state.audit.filter((a) => inRange(a.created)),
                      "inspirers-activity.csv",
                    )
                  }
                >
                  <Download size={15} />
                  Export
                </button>
              </div>
              {state.audit
                .filter(
                  (a) =>
                    inRange(a.created) &&
                    (!query ||
                      JSON.stringify(a)
                        .toLowerCase()
                        .includes(query.toLowerCase())),
                )
                .map((a) => (
                  <div className="audit-row" key={a.id}>
                    <span className="activity-mark">
                      <History size={17} />
                    </span>
                    <div>
                      <b>{a.action}</b>
                      <small>
                        {a.actor.length > 45 ? "Website visitor" : a.actor}{" "}
                        {a.record_id ? "· " + a.record_id : ""}
                      </small>
                    </div>
                    <time>{new Date(a.created).toLocaleString()}</time>
                  </div>
                ))}
              {!state.audit.length && (
                <Empty
                  title="A clean activity log"
                  copy="Important changes are recorded here automatically."
                />
              )}
            </section>
          )}
          {section === "settings" && (
            <Tabs
              value={settingsTab}
              onValueChange={setSettingsTab}
              className="settings-layout"
            >
              <TabsList className="settings-nav">
                {[
                  "Agency profile",
                  "Branding",
                  "Social integrations",
                  "Team permissions",
                  "Notifications",
                  "Email configuration",
                  "Account & security",
                  "Data export",
                ].map((t) => (
                  <TabsTrigger
                    className={settingsTab === t ? "active" : ""}
                    value={t}
                    key={t}
                  >
                    {t}
                  </TabsTrigger>
                ))}
              </TabsList>
              <section className="panel settings-panel">
                <h2>{settingsTab}</h2>
                {["Agency profile", "Branding", "Notifications"].includes(
                  settingsTab,
                ) ? (
                  <AgencySettings
                    state={state}
                    tab={settingsTab}
                    canEdit={isAdmin}
                    onSave={async (data) => {
                      try {
                        await api("settings", data);
                        await load();
                        notify("Settings saved.");
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  />
                ) : settingsTab === "Social integrations" ? (
                  <>
                    <p className="muted-copy">
                      Provider secrets are configured on the server. This page
                      never exposes them.
                    </p>
                    {platforms.map((p) => (
                      <div className="integration-row" key={p}>
                        <span className="platform-icon">
                          {(() => {
                            const P = platformIcons[p];
                            return <P />;
                          })()}
                        </span>
                        <div>
                          <b>{p}</b>
                          <small>
                            {p === "Gmail"
                              ? "Google OAuth · account identity"
                              : p === "TikTok"
                                ? "Official Login Kit"
                                : "Meta OAuth"}
                          </small>
                        </div>
                        <Badge>
                          {state.integrationReady[p]
                            ? "Configured"
                            : "API setup required"}
                        </Badge>
                      </div>
                    ))}
                    <a
                      className="btn outline"
                      href="/SETUP.md"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View integration setup guide
                    </a>
                  </>
                ) : settingsTab === "Team permissions" ? (
                  <>
                    <p>
                      Permissions are enforced on the server for every record
                      and uploaded file.
                    </p>
                    <Link className="btn outline" href="/dashboard/team">
                      Manage team members
                    </Link>
                  </>
                ) : settingsTab === "Email configuration" ? (
                  <>
                    <div className="setup-note">
                      <Mail />
                      <div>
                        <strong>
                          {state.authConfigured
                            ? "Supabase Auth configured"
                            : "Email authentication setup required"}
                        </strong>
                        <p>
                          Configure Supabase Auth, verification emails, recovery
                          URLs and custom SMTP before inviting external users by
                          email.
                        </p>
                      </div>
                    </div>
                    <p className="muted-copy">
                      Invitations are created as secure shareable links.
                      Automated email delivery is not enabled in this phase.
                    </p>
                    <a
                      href="/SETUP.md"
                      className="btn outline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read email setup instructions
                    </a>
                  </>
                ) : settingsTab === "Account & security" ? (
                  <AccountSettings
                    user={state.user}
                    notify={notify}
                    load={load}
                  />
                ) : (
                  <>
                    <p>
                      Export your permitted workspace records. The export
                      contains contact details and internal notes.
                    </p>
                    <button
                      className="btn charcoal"
                      onClick={() =>
                        exportCsv(
                          state.records.map((r) => ({
                            id: r.id,
                            kind: r.kind,
                            ...r.data,
                          })),
                          "inspirers-workspace.csv",
                        )
                      }
                    >
                      <Download size={16} />
                      Export workspace CSV
                    </button>
                    <button className="btn outline" onClick={exportTracking}>
                      Export tracking report
                    </button>
                  </>
                )}
              </section>
            </Tabs>
          )}
        </main>
        <footer className="workspace-footer">
          <span>INSPIRERS’ DEN</span>
          <span>Your network. Your next story.</span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {editing && (
        <Modal
          title={(editing.entry ? "Edit " : "New ") + editing.kind}
          wide
          variant="form"
          onClose={() => setEditing(null)}
        >
          <EntryForm
            kind={editing.kind}
            entry={editing.entry}
            creators={creators}
            onSave={(data, photo) =>
              save(editing.kind, data, editing.entry, photo)
            }
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
      {selected && (
        <Modal
          title={
            (selected.kind === "lead"
              ? "Inquiry"
              : selected.kind.charAt(0).toUpperCase() +
                selected.kind.slice(1)) + " details"
          }
          wide
          variant="detail"
          onClose={() => setSelected(null)}
        >
          <div className="detail-heading">
            {selected.kind === "influencer" && (
              <Avatar entry={selected} size="large" />
            )}
            <div>
              <span className="card-overline">
                {selected.id} · {selected.kind}
              </span>
              <h3>{selected.data.name}</h3>
              <Badge>{selected.data.status || "Saved"}</Badge>
            </div>
            <div className="detail-actions">
              {writable(selected) && (
                <button
                  className="btn outline small"
                  onClick={() => {
                    setEditing({ kind: selected.kind, entry: selected });
                    setSelected(null);
                  }}
                >
                  Edit profile
                </button>
              )}
              {isAdmin && (
                <button
                  className="btn danger-outline small"
                  onClick={() => {
                    setDeleteTarget(selected);
                    setSelected(null);
                  }}
                >
                  <Trash2 size={15} />
                  Delete {selected.kind === "lead" ? "inquiry" : selected.kind}
                </button>
              )}
              {selected.kind === "influencer" && writable(selected) && (
                <button
                  className="icon-button"
                  aria-label="Archive or reactivate influencer"
                  onClick={() => archive(selected)}
                >
                  <Archive size={18} />
                </button>
              )}
            </div>
          </div>
          {selected.data.source && (
            <p className="source-note">{selected.data.source}</p>
          )}
          <div className="detail-grid">
            {definitions[selected.kind]
              ?.filter((f) => !["notes", "bio", "deliverables"].includes(f.key))
              .map((f) => (
                <div key={f.key}>
                  <small>{f.label}</small>
                  <strong>
                    {f.type === "influencer"
                      ? creators.find((c) => c.id === selected.data[f.key])
                          ?.data.name || "—"
                      : f.type === "multi-influencer"
                        ? ((selected.data[f.key] as string[]) || [])
                            .map(
                              (i) =>
                                creators.find((c) => c.id === i)?.data.name ||
                                i,
                            )
                            .join(", ") || "—"
                        : String(selected.data[f.key] || "—")}
                  </strong>
                </div>
              ))}
          </div>
          {["bio", "deliverables", "notes", "requirement"]
            .filter((k) => selected.data[k] && (k !== "notes" || isStaff))
            .map((k) => (
              <div className="detail-text" key={k}>
                <h4>
                  {k === "bio"
                    ? "Biography"
                    : k === "notes"
                      ? "Internal notes"
                      : k === "requirement"
                        ? "Campaign requirement"
                        : "Deliverables"}
                </h4>
                <p>{selected.data[k]}</p>
              </div>
            ))}
          {selected.kind === "influencer" && (
            <>
              <div className="tracking-detail">
                <div>
                  <h4>One creator. One unique connection.</h4>
                  <p>
                    Every link opens the central agency WhatsApp with reference{" "}
                    <b>{selected.id}</b>.
                  </p>
                  <code>{tracked(selected)}</code>
                  <div className="media-actions">
                    <button
                      className="btn gold small"
                      onClick={() => copy(tracked(selected))}
                    >
                      <Copy size={14} />
                      Copy tracked link
                    </button>
                    <a
                      href={tracked(selected)}
                      className="btn outline small"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open WhatsApp
                    </a>
                    {isAdmin && (
                      <button
                        className="btn outline small"
                        onClick={() => {
                          setInvite(selected);
                          setSelected(null);
                        }}
                      >
                        Create portal invitation
                      </button>
                    )}
                  </div>
                </div>
                <Qr url={tracked(selected)} />
              </div>
              {selected.data.portalInvitation && isAdmin && (
                <div className="invitation-result">
                  <h4>Generated portal invitation</h4>
                  <code>{String(selected.data.portalInvitation)}</code>
                  <button
                    className="btn outline small"
                    onClick={() => copy(String(selected.data.portalInvitation))}
                  >
                    <Copy size={14} />
                    Copy portal invitation
                  </button>
                  <p className="caption">
                    Email-bound, single-use invitation. Expires 7 days after
                    profile creation.
                  </p>
                </div>
              )}
              <div className="detail-stats">
                {[
                  [
                    "Link clicks",
                    state.clicks.filter((c) => c.influencer_id === selected.id)
                      .length,
                  ],
                  [
                    "Inquiries",
                    state.records.filter(
                      (l) =>
                        l.kind === "lead" &&
                        (l.data.influencerId === selected.id ||
                          l.data.reference === selected.id),
                    ).length,
                  ],
                  [
                    "Conversions",
                    state.records.filter(
                      (l) =>
                        l.kind === "lead" &&
                        l.data.status === "Confirmed" &&
                        (l.data.influencerId === selected.id ||
                          l.data.reference === selected.id),
                    ).length,
                  ],
                ].map(([l, n]) => (
                  <div key={l}>
                    <strong>{n}</strong>
                    <span>{l}</span>
                  </div>
                ))}
              </div>
              <div className="social-grid">
                {platforms.map((p) => socialCard(selected, p))}
              </div>
            </>
          )}
          {selected.data.kit && (
            <a
              href={String(selected.data.kit)}
              target="_blank"
              rel="noreferrer"
              className="btn outline"
            >
              <FileText size={16} />
              Preview supplied media kit
            </a>
          )}
          <div className="detail-text">
            <h4>Attachments</h4>
            {state.files
              .filter((f) => f.record_id === selected.id)
              .map((f) => (
                <div className="attachment-row" key={f.id}>
                  <a
                    href={"/api/file/" + f.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {f.name}
                  </a>
                  <div className="attachment-actions">
                    <a
                      className="icon-button"
                      aria-label={"Download " + f.name}
                      href={"/api/file/" + f.id + "?download=1"}
                    >
                      <Download size={16} />
                    </a>
                    {writable(selected) && (
                      <button
                        className="icon-button delete-file-button"
                        aria-label={"Delete " + f.name}
                        onClick={() => {
                          setFileDeleteTarget({ file: f, record: selected });
                          setSelected(null);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            {writable(selected) && (
              <button
                className="btn outline small"
                onClick={() => {
                  setUploadRecord(selected);
                  setSelected(null);
                }}
              >
                <Upload size={15} />
                Upload file or profile photo
              </button>
            )}
          </div>
          {selected.kind === "package" && <PackageHistory entry={selected} />}
          <RecordTimeline entry={selected} />
        </Modal>
      )}
      {deleteTarget && (
        <Modal
          title={"Delete " + deleteTarget.data.name}
          variant="danger"
          onClose={() => setDeleteTarget(null)}
        >
          <DeleteRecord
            entry={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onDelete={async () => {
              const result = await api(
                "records/" + deleteTarget.id + "/delete",
                {
                  confirm: String(deleteTarget.data.name),
                  version: deleteTarget.version,
                },
              );
              await load();
              setDeleteTarget(null);
              setSelected(null);
              notify(
                result.storageCleanupPending
                  ? "Record deleted. Some private file cleanup is still pending."
                  : `${deleteTarget.kind === "lead" ? "Inquiry" : deleteTarget.kind.charAt(0).toUpperCase() + deleteTarget.kind.slice(1)} deleted permanently.`,
              );
            }}
          />
        </Modal>
      )}
      {fileDeleteTarget && (
        <Modal
          title="Delete uploaded file"
          variant="danger"
          onClose={() => setFileDeleteTarget(null)}
        >
          <DeleteFile
            file={fileDeleteTarget.file}
            onCancel={() => setFileDeleteTarget(null)}
            onDelete={async () => {
              await api(`file/${fileDeleteTarget.file.id}/delete`, {});
              await load();
              setFileDeleteTarget(null);
              notify("File deleted permanently.");
            }}
          />
        </Modal>
      )}
      {invite && (
        <Modal title="Invite to the den" onClose={() => setInvite(null)}>
          <InviteForm
            entry={typeof invite === "object" ? invite : undefined}
            creators={creators}
            user={state.user}
            copy={copy}
            notify={notify}
          />
        </Modal>
      )}
      {uploadRecord && (
        <Modal
          title={"Upload for " + uploadRecord.data.name}
          onClose={() => setUploadRecord(null)}
        >
          <UploadForm
            entry={uploadRecord}
            onDone={async () => {
              await load();
              setUploadRecord(null);
              notify("File uploaded securely.");
            }}
          />
        </Modal>
      )}
    </SidebarProvider>
  );
}
function DeleteRecord({
  entry,
  onDelete,
  onCancel,
}: {
  entry: Entry;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="delete-confirm"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          await onDelete();
        } catch (error) {
          setMessage((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="delete-warning-icon">
        <Trash2 size={22} />
      </div>
      <h3>
        Delete this {entry.kind === "lead" ? "inquiry" : entry.kind}{" "}
        permanently?
      </h3>
      <p>
        {entry.kind === "influencer"
          ? "The profile, tracking data, account connections and private uploads will be removed. Linked records will remain without this creator."
          : "This record and its private uploads will be removed permanently. This action cannot be undone."}
      </p>
      <label>
        Type <strong>{entry.data.name}</strong> to confirm
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </label>
      {message && (
        <p className="form-message error" role="alert">
          {message}
        </p>
      )}
      <div className="delete-confirm-actions">
        <button
          type="button"
          className="btn outline"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          className="btn danger"
          disabled={busy || name !== String(entry.data.name)}
        >
          <Trash2 size={15} />
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </form>
  );
}
function DeleteFile({
  file,
  onDelete,
  onCancel,
}: {
  file: FileInfo;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="delete-confirm">
      <div className="delete-warning-icon">
        <Trash2 size={22} />
      </div>
      <h3>Delete “{file.name}”?</h3>
      <p>
        The file will be removed from the record and private storage. This
        action cannot be undone.
      </p>
      {message && (
        <p className="form-message error" role="alert">
          {message}
        </p>
      )}
      <div className="delete-confirm-actions">
        <button className="btn outline" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          className="btn danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            try {
              await onDelete();
            } catch (error) {
              setMessage((error as Error).message);
              setBusy(false);
            }
          }}
        >
          <Trash2 size={15} />
          {busy ? "Deleting…" : "Delete file"}
        </button>
      </div>
    </div>
  );
}
function Qr({ url }: { url: string }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 160,
      margin: 1,
      errorCorrectionLevel: "M",
    }).then(setImage);
  }, [url]);
  return image ? (
    <a href={image} download="influencer-whatsapp-qr.png" className="qr-code">
      <img src={image} alt="Tracked WhatsApp link QR code" />
      <small>Download QR code</small>
    </a>
  ) : null;
}
function EntryForm({
  kind,
  entry,
  creators,
  onSave,
  onCancel,
}: {
  kind: string;
  entry?: Entry;
  creators: Entry[];
  onSave: (data: Data, photo?: File) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [data, setData] = useState<Data>(() =>
      Object.fromEntries(
        definitions[kind].map((f) => [
          f.key,
          entry?.data[f.key] ??
            (f.type === "multi-influencer"
              ? []
              : (f.options?.[0] ?? (f.type === "number" ? 0 : ""))),
        ]),
      ),
    ),
    [busy, setBusy] = useState(false),
    [photo, setPhoto] = useState<File | undefined>();
  function field(f: Field) {
    const common = {
      id: "field-" + f.key,
      required:
        !!f.required || (kind === "influencer" && f.key === "email" && !entry),
    };
    if (f.type === "multi-influencer")
      return (
        <div className="checkbox-list">
          {creators.map((c) => (
            <label key={c.id}>
              <Checkbox
                checked={(data[f.key] as string[]).includes(c.id)}
                onCheckedChange={(checked) =>
                  setData({
                    ...data,
                    [f.key]:
                      checked === true
                        ? [...(data[f.key] as string[]), c.id]
                        : (data[f.key] as string[]).filter((i) => i !== c.id),
                  })
                }
              />
              {c.data.name}
            </label>
          ))}
        </div>
      );
    if (f.options || f.type === "influencer")
      return (
        <Choice
          {...common}
          value={String(data[f.key] || "")}
          onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
        >
          {f.type === "influencer" && (
            <option value="">Select influencer</option>
          )}
          {f.type === "influencer"
            ? creators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.data.name}
                </option>
              ))
            : f.options?.map((o) => <option key={o}>{o}</option>)}
        </Choice>
      );
    if (f.type === "textarea")
      return (
        <textarea
          {...common}
          rows={3}
          maxLength={10000}
          value={String(data[f.key] || "")}
          onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
        />
      );
    return (
      <input
        {...common}
        type={f.type || "text"}
        min={f.type === "number" ? 0 : undefined}
        step={f.type === "number" ? "any" : undefined}
        maxLength={500}
        value={String(data[f.key] ?? "")}
        onChange={(e) =>
          setData({
            ...data,
            [f.key]:
              f.type === "number" ? Number(e.target.value) : e.target.value,
          })
        }
      />
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave(data, photo);
        setBusy(false);
      }}
    >
      {kind === "influencer" && (
        <label className="profile-photo-field" htmlFor="influencer-photo">
          <span className="profile-photo-preview">
            {entry ? (
              <Avatar entry={entry} size="large" />
            ) : (
              <Upload size={22} />
            )}
          </span>
          <span>
            <b>Profile photo</b>
            <small>Stored privately in Supabase · JPEG, PNG or WebP</small>
            <input
              id="influencer-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setPhoto(event.target.files?.[0])}
            />
          </span>
        </label>
      )}
      <div className="form-grid">
        {definitions[kind].map((f) => (
          <label
            className={
              f.type === "textarea" || f.type === "multi-influencer"
                ? "full"
                : ""
            }
            htmlFor={"field-" + f.key}
            key={f.key}
          >
            {f.label}
            {f.required ? " *" : ""}
            {field(f)}
          </label>
        ))}
      </div>
      <div className="modal-form-actions">
        <button type="button" className="btn outline" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn gold" disabled={busy}>
          <Save size={16} />
          {busy ? "Saving…" : entry ? "Save changes" : "Create " + kind}
        </button>
      </div>
    </form>
  );
}
function InviteForm({
  entry,
  creators,
  user,
  copy,
  notify,
}: {
  entry?: Entry;
  creators: Entry[];
  user: Member;
  copy: (s: string) => void;
  notify: (s: string) => void;
}) {
  const [role, setRole] = useState(entry ? "Influencer" : "Manager"),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const data = Object.fromEntries(new FormData(e.currentTarget));
          const result = await api("invite", { ...data, role });
          setUrl(result.url);
          notify(result.message);
        } catch (e) {
          notify((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="muted-copy">
        Create a single-use invitation for a verified email. It expires in 7
        days.
      </p>
      <label>
        Email address
        <input
          type="email"
          name="email"
          defaultValue={entry ? String(entry.data.email || "") : ""}
          required
        />
      </label>
      <label>
        Role
        <Choice value={role} onChange={(e) => setRole(e.target.value)}>
          {(user.role === "Agency Owner"
            ? ["Admin", "Manager", "Influencer"]
            : ["Manager", "Influencer"]
          ).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Choice>
      </label>
      {role === "Influencer" && (
        <label>
          Influencer profile
          <Choice name="influencerId" defaultValue={entry?.id} required>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.data.name}
              </option>
            ))}
          </Choice>
        </label>
      )}
      <button className="btn gold" disabled={busy}>
        {busy ? "Creating…" : "Create invitation link"}
      </button>
      {url && (
        <div className="invitation-result">
          <code>{url}</code>
          <button
            type="button"
            className="btn outline"
            onClick={() => copy(url)}
          >
            <Copy size={16} />
            Copy invitation
          </button>
        </div>
      )}
    </form>
  );
}
function UploadForm({ entry, onDone }: { entry: Entry; onDone: () => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const form = new FormData(e.currentTarget);
          form.set("recordId", entry.id);
          const r = await fetch("/api/upload", { method: "POST", body: form });
          const d = await readJson(r);
          if (!r.ok) throw new Error(d.error);
          onDone();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="upload-zone">
        <Upload size={35} />
        <h3>A new addition to the library</h3>
        <p>PDF, JPEG, PNG or WebP · up to 10 MB</p>
        <input
          type="file"
          name="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required
        />
      </div>
      {entry.kind === "influencer" && (
        <label>
          Use this file as
          <Choice name="purpose">
            <option value="media-kit">
              Active media kit (agent can share)
            </option>
            <option value="attachment">General attachment</option>
            <option value="avatar">Profile photo (image only)</option>
          </Choice>
        </label>
      )}
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
      <button className="btn gold" disabled={busy}>
        {busy ? "Uploading…" : "Upload file"}
      </button>
    </form>
  );
}
function PackageHistory({ entry }: { entry: Entry }) {
  const [versions, setVersions] = useState<
    { id: string; version: number; created: string; data: string }[]
  >([]);
  useEffect(() => {
    api<{ id: string; version: number; created: string; data: string }[]>(
      "records/" + entry.id + "/versions",
    )
      .then(setVersions)
      .catch(() => null);
  }, [entry.id]);
  return (
    <div className="detail-text">
      <h4>Package versions</h4>
      {versions.map((v) => (
        <details key={v.id}>
          <summary>
            Version {v.version} · {date(v.created)}
          </summary>
          <p>{JSON.parse(v.data).deliverables}</p>
        </details>
      ))}
      {!versions.length && (
        <p className="muted-copy">
          Imported baseline · version {entry.version}. Future edits are saved in
          version history.
        </p>
      )}
    </div>
  );
}
function AgencySettings({
  state,
  tab,
  canEdit,
  onSave,
}: {
  state: State;
  tab: string;
  canEdit: boolean;
  onSave: (d: Data) => Promise<void>;
}) {
  const [data, setData] = useState(state.settings),
    [busy, setBusy] = useState(false);
  const fields =
    tab === "Branding"
      ? [
          ["name", "Agency name"],
          ["logo", "Logo image URL / uploaded file path"],
        ]
      : tab === "Agency profile"
        ? [
            ["name", "Agency name"],
            ["email", "Contact email"],
            ["phone", "Contact number"],
            ["whatsapp", "Central WhatsApp number (digits only)"],
            ["instagram", "Instagram URL"],
            ["website", "Website URL"],
          ]
        : [];
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave(data);
        setBusy(false);
      }}
    >
      {tab === "Branding" && (
        <>
          {canEdit && (
            <label>
              Upload official logo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  try {
                    const form = new FormData();
                    form.set("file", file);
                    form.set("recordId", "agency");
                    form.set("purpose", "logo");
                    const res = await fetch("/api/upload", {
                      method: "POST",
                      body: form,
                    });
                    const result = await readJson(res);
                    if (!res.ok) throw new Error(result.error);
                    setData({ ...data, logo: result.logo });
                  } catch (e) {
                    window.alert((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
          )}
          <img
            className="settings-logo"
            src={String(data.logo)}
            alt="Agency logo"
          />
          <div className="brand-swatches">
            {["#E6D03E", "#2D2B2C", "#413F40", "#818181", "#FFFFFF"].map(
              (c) => (
                <span key={c}>
                  <i style={{ background: c }} />
                  {c}
                </span>
              ),
            )}
          </div>
        </>
      )}
      {fields.map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            required={!["website", "logo"].includes(key)}
            type={
              key === "email"
                ? "email"
                : key === "instagram" || key === "website"
                  ? "url"
                  : "text"
            }
            value={String(data[key] || "")}
            disabled={!canEdit}
            onChange={(e) => setData({ ...data, [key]: e.target.value })}
          />
        </label>
      ))}
      {tab === "Notifications" && (
        <label className="switch-label">
          <Checkbox
            checked={!!data.notifications}
            disabled={!canEdit}
            onCheckedChange={(checked) =>
              setData({ ...data, notifications: checked === true })
            }
          />
          Show workspace inquiry notifications
        </label>
      )}
      {canEdit && (
        <button className="btn gold" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      )}
    </form>
  );
}
function AccountSettings({
  user,
  notify,
  load,
}: {
  user: Member;
  notify: (s: string) => void;
  load: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(
              "profile",
              Object.fromEntries(new FormData(e.currentTarget)),
            );
            await load();
            notify("Profile updated.");
          } catch (e) {
            notify((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Display name
          <input name="name" defaultValue={user.name} required minLength={2} />
        </label>
        <label>
          Email address
          <input disabled value={user.email} />
        </label>
        <button className="btn gold" disabled={busy}>
          Save profile
        </button>
      </form>
      <div className="detail-text">
        <h4>Password</h4>
        <p className="muted-copy">
          Email accounts can reset their password through a verified recovery
          link. Use the email associated with your account.
        </p>
        <Link href="/auth/forgot" className="btn outline">
          Reset email password
        </Link>
      </div>
      <div className="permission-note">
        <ShieldCheck />
        <p>
          Dashboard access requires a verified email account. Sessions use
          secure, HTTP-only cookies.
        </p>
      </div>
    </>
  );
}

function RecordTimeline({ entry }: { entry: Entry }) {
  const [rows, setRows] = useState<State["audit"]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<State["audit"]>("records/" + entry.id + "/activity")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [entry.id]);
  return (
    <div className="detail-text">
      <h4>Activity timeline</h4>
      {error && <p role="alert">{error}</p>}
      {rows.map((a) => (
        <div className="activity-mini" key={a.id}>
          <History size={14} />
          <div>
            <b>{a.action}</b>
            <small>{new Date(a.created).toLocaleString()}</small>
          </div>
        </div>
      ))}
      {!rows.length && !error && (
        <p className="muted-copy">No recorded changes yet.</p>
      )}
    </div>
  );
}
