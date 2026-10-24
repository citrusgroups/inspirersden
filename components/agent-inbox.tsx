"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  CirclePause,
  Hand,
  Play,
  Send,
  Check,
  X,
  CheckCircle2,
  Archive,
  FlaskConical,
  Trash2,
} from "lucide-react";
import { readJson } from "@/lib/json";

type Conversation = {
  id: string;
  channel: string;
  external_thread_id: string;
  external_user_id: string;
  influencer_id: string | null;
  lead_id: string | null;
  contact_name: string | null;
  brand_name: string | null;
  summary: string | null;
  email: string | null;
  phone: string | null;
  social_links: string;
  requirement: string | null;
  budget: string | null;
  status: string;
  stage: string;
  last_message_at: string;
};
type Message = {
  id: string;
  direction: string;
  role: string;
  content: string;
  status: string;
  created: string;
};
type Action = {
  id: string;
  action_type: string;
  payload: { packageId?: string };
  status: string;
  requested: string;
  error?: string;
};
type Configuration = {
  ai: boolean;
  whatsapp: boolean;
  instagram: boolean;
  autoReply: boolean;
};

function parsedSocialLinks(value: string) {
  try {
    return (JSON.parse(value || "[]") as string[]).join(", ") || "Not collected";
  } catch {
    return "Not collected";
  }
}

function LeadSnapshot({
  active,
  creatorName,
}: {
  active?: Conversation;
  creatorName: string;
}) {
  if (!active) return <p>No conversation selected.</p>;
  return (
    <div className="agent-details-content">
      <label>
        Creator<strong>{creatorName}</strong>
      </label>
      <label>
        Lead record<strong>{active.lead_id || "Creating…"}</strong>
      </label>
      <label>
        Channel<strong>{active.channel}</strong>
      </label>
      <label>
        Agent status<strong>{active.status}</strong>
      </label>
      <label>
        Deal stage<strong>{active.stage}</strong>
      </label>
      <label>
        Email<strong>{active.email || "Not collected"}</strong>
      </label>
      <label>
        Phone<strong>{active.phone || "Not collected"}</strong>
      </label>
      <label>
        Social links<strong>{parsedSocialLinks(active.social_links)}</strong>
      </label>
      <label>
        Requirement<p>{active.requirement || "Not collected"}</p>
      </label>
      <label>
        Budget<strong>{active.budget || "Not collected"}</strong>
      </label>
      <label>
        Summary
        <p>{active.summary || "The agent is still collecting details."}</p>
      </label>
    </div>
  );
}
async function request<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const data = await readJson(r);
  if (!r.ok) throw new Error(data.error || "Action failed");
  return data as T;
}

export default function AgentInbox({
  influencers,
  packages,
  isAdmin,
  isStaff,
}: {
  influencers: { id: string; data: { name?: unknown } }[];
  packages: { id: string; data: { name?: unknown } }[];
  isAdmin: boolean;
  isStaff: boolean;
}) {
  const [rows, setRows] = useState<Conversation[]>([]),
    [selected, setSelected] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [actions, setActions] = useState<Action[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleteOpen, setDeleteOpen] = useState(false),
    [configuration, setConfiguration] = useState<Configuration>({
      ai: false,
      whatsapp: false,
      instagram: false,
      autoReply: false,
    });
  const messageList = useRef<HTMLDivElement>(null);
  const deleteCancel = useRef<HTMLButtonElement>(null);
  const list = useCallback(async () => {
    try {
      const data = await request<{
        conversations: Conversation[];
        configuration: Configuration;
      }>("/api/agent");
      setRows(data.conversations);
      setConfiguration(data.configuration);
      setSelected((current) =>
        data.conversations.some((conversation) => conversation.id === current)
          ? current
          : data.conversations[0]?.id || "",
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  const detail = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const data = await request<{ messages: Message[]; actions: Action[] }>(
        "/api/agent?conversationId=" + encodeURIComponent(id),
      );
      setMessages(data.messages);
      setActions(data.actions);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => void list());
    const timer = setInterval(list, 15000);
    return () => clearInterval(timer);
  }, [list]);
  useEffect(() => {
    queueMicrotask(() => void detail(selected));
    if (!selected) return;
    const timer = setInterval(() => void detail(selected), 7000);
    return () => clearInterval(timer);
  }, [selected, detail]);
  useEffect(() => {
    const listElement = messageList.current;
    if (!listElement) return;
    listElement.scrollTo({ top: listElement.scrollHeight, behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    if (!deleteOpen) return;
    deleteCancel.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deleteOpen]);
  const creator = (creatorId: string | null) =>
    influencers.find((i) => i.id === creatorId)?.data.name ||
    creatorId ||
    "Agency";
  const active = rows.find((r) => r.id === selected);
  const activeCreator = String(creator(active?.influencer_id || null));
  const isTestInquiry = Boolean(active?.external_thread_id?.startsWith("demo-"));
  async function act(action: string, extra: Record<string, string> = {}) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/agent", {
        conversationId: selected,
        action,
        ...extra,
      });
      setText("");
      await Promise.all([list(), detail(selected)]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function simulate() {
    setBusy(true);
    setError("");
    try {
      const result = await request<{ conversationId: string }>("/api/agent", {
        action: "simulate",
      });
      await list();
      setSelected(result.conversationId);
      await detail(result.conversationId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeTestInquiry() {
    if (!selected || !isTestInquiry) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/agent", {
        conversationId: selected,
        action: "delete",
      });
      setDeleteOpen(false);
      setSelected("");
      setMessages([]);
      setActions([]);
      await list();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="agent-workspace">
      <div className="agent-readiness" role="status">
        <span className={configuration.ai ? "ready" : "draft"}>
          AI {configuration.ai ? "connected" : "safe fallback"}
        </span>
        <span className={configuration.whatsapp ? "ready" : "setup"}>
          WhatsApp {configuration.whatsapp ? "ready" : "setup required"}
        </span>
        <span className={configuration.instagram ? "ready" : "setup"}>
          Instagram {configuration.instagram ? "ready" : "setup required"}
        </span>
        <strong>
          {configuration.autoReply
            ? "Auto-reply enabled"
            : "Draft approval mode"}
        </strong>
        {isAdmin && (
          <button
            className="btn outline small"
            disabled={busy}
            onClick={simulate}
          >
            <FlaskConical size={14} />
            Create test inquiry
          </button>
        )}
      </div>
      <div className="agent-shell">
        <aside className="agent-list">
          <div className="agent-list-title">
            <Bot size={18} />
            <b>Live conversations</b>
            <span>{rows.length}</span>
          </div>
          {rows.map((c) => (
            <button
              key={c.id}
              className={selected === c.id ? "active" : ""}
              onClick={() => setSelected(c.id)}
            >
              <span>
                <b>{c.brand_name || c.contact_name || c.external_user_id}</b>
                <small>
                  {String(creator(c.influencer_id))} · {c.channel}
                </small>
              </span>
              <span className="agent-list-meta">
                <em>{c.status}</em>
                {c.external_thread_id?.startsWith("demo-") && (
                  <i className="agent-test-label">Test</i>
                )}
              </span>
            </button>
          ))}
          {!rows.length && (
            <p>
              No agent conversations yet. New WhatsApp and Instagram messages
              will appear here.
            </p>
          )}
        </aside>
        <section className="agent-chat">
          {active ? (
            <>
              <header>
                <div className="agent-chat-identity">
                  <h2>
                    {active.brand_name ||
                      active.contact_name ||
                      active.external_user_id}
                  </h2>
                  <p>
                    {String(creator(active.influencer_id))} · {active.channel} ·{" "}
                    {active.stage}
                  </p>
                </div>
                <div className="agent-header-actions">
                  {active.status === "active" ? (
                    <button
                      className="btn outline small"
                      onClick={() => act("pause")}
                      disabled={busy}
                    >
                      <CirclePause size={15} />
                      Pause AI
                    </button>
                  ) : (
                    <button
                      className="btn outline small"
                      onClick={() => act("resume")}
                      disabled={busy}
                    >
                      <Play size={15} />
                      Resume AI
                    </button>
                  )}
                  <button
                    className="btn outline small"
                    onClick={() => act("handoff")}
                    disabled={busy}
                  >
                    <Hand size={15} />
                    Human handoff
                  </button>
                  {isStaff && (
                    <>
                      <button
                        className="btn outline small"
                        onClick={() => act("confirm")}
                        disabled={busy || active.stage === "confirmed"}
                      >
                        <CheckCircle2 size={15} />
                        Deal confirmed
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => act("close")}
                        disabled={busy || active.status === "closed"}
                        aria-label="Close conversation"
                        title="Close conversation"
                      >
                        <Archive size={16} />
                      </button>
                    </>
                  )}
                  {isAdmin && isTestInquiry && (
                    <button
                      className="btn danger-outline small"
                      onClick={() => setDeleteOpen(true)}
                      disabled={busy}
                    >
                      <Trash2 size={15} />
                      Delete test
                    </button>
                  )}
                </div>
              </header>
              <details className="agent-details-mobile">
                <summary>
                  <span>Lead snapshot</span>
                  <small>{active.stage}</small>
                </summary>
                <LeadSnapshot active={active} creatorName={activeCreator} />
              </details>
              <div className="agent-messages" ref={messageList}>
                {messages.map((m) => (
                  <div key={m.id} className={"agent-message " + m.direction}>
                    <small>
                      {m.role === "human"
                        ? "Team"
                        : m.role === "assistant"
                          ? "AI Agent"
                          : "Client"}
                    </small>
                    <p>{m.content}</p>
                    <time>
                      {new Date(m.created).toLocaleString()} · {m.status}
                    </time>
                    {m.direction === "outbound" &&
                      m.role === "assistant" &&
                      ["draft", "failed"].includes(m.status) && (
                        <button
                          className="agent-send-draft"
                          disabled={busy}
                          onClick={() => act("send-draft", { messageId: m.id })}
                        >
                          <Send size={13} />
                          {m.status === "failed"
                            ? "Retry send"
                            : "Approve & send"}
                        </button>
                      )}
                  </div>
                ))}
              </div>
              {actions
                .filter((a) => a.status === "pending")
                .map((a) => (
                  <div className="agent-approval" key={a.id}>
                    <div>
                      <b>Package approval required</b>
                      <small>
                        {String(
                          packages.find((p) => p.id === a.payload.packageId)
                            ?.data.name ||
                            a.payload.packageId ||
                            "Recommended package",
                        )}
                      </small>
                    </div>
                    {isAdmin && (
                      <>
                        <button
                          className="btn gold small"
                          disabled={busy}
                          onClick={() => act("approve", { actionId: a.id })}
                        >
                          <Check size={14} />
                          {configuration.autoReply
                            ? "Approve & send"
                            : "Approve package"}
                        </button>
                        <button
                          className="icon-button"
                          disabled={busy}
                          onClick={() => act("reject", { actionId: a.id })}
                          aria-label="Reject package"
                        >
                          <X size={15} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              <form
                className="agent-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("send", { text });
                }}
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a manual reply…"
                  maxLength={4000}
                />
                <button className="btn gold" disabled={busy || !text.trim()}>
                  <Send size={16} />
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="agent-empty">
              <Bot />
              <h2>Agent Inbox</h2>
              <p>
                Select a conversation to review messages, collected lead details
                and approvals.
              </p>
            </div>
          )}
          {error && <p className="form-message error">{error}</p>}
        </section>
        <aside className="agent-details">
          <h3>Lead snapshot</h3>
          <LeadSnapshot active={active} creatorName={activeCreator} />
        </aside>
      </div>
      {deleteOpen && active && (
        <div
          className="agent-delete-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setDeleteOpen(false);
          }}
        >
          <section
            className="agent-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-test-title"
            aria-describedby="delete-test-description"
          >
            <span className="delete-warning-icon">
              <Trash2 size={21} />
            </span>
            <h3 id="delete-test-title">Delete test inquiry?</h3>
            <p id="delete-test-description">
              This permanently removes the demo conversation, its messages,
              approvals and generated test lead. Real client inquiries are not
              affected.
            </p>
            <div className="delete-confirm-actions">
              <button
                ref={deleteCancel}
                className="btn outline"
                onClick={() => setDeleteOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="btn danger"
                onClick={() => void removeTestInquiry()}
                disabled={busy}
              >
                <Trash2 size={15} />
                {busy ? "Deleting…" : "Delete test inquiry"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
