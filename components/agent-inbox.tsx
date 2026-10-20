"use client";
import { useCallback, useEffect, useState } from "react";
import { Bot, CirclePause, Hand, Play, Send, Check, X } from "lucide-react";
import { readJson } from "@/lib/json";

type Conversation = {
  id: string;
  channel: string;
  external_user_id: string;
  influencer_id: string | null;
  lead_id: string | null;
  contact_name: string | null;
  brand_name: string | null;
  summary: string | null;
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
}: {
  influencers: { id: string; data: { name?: unknown } }[];
  packages: { id: string; data: { name?: unknown } }[];
  isAdmin: boolean;
}) {
  const [rows, setRows] = useState<Conversation[]>([]),
    [selected, setSelected] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [actions, setActions] = useState<Action[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const list = useCallback(async () => {
    try {
      const data = await request<{ conversations: Conversation[] }>(
        "/api/agent",
      );
      setRows(data.conversations);
      setSelected((current) => current || data.conversations[0]?.id || "");
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
  }, [selected, detail]);
  const active = rows.find((r) => r.id === selected);
  const creator = (creatorId: string | null) =>
    influencers.find((i) => i.id === creatorId)?.data.name ||
    creatorId ||
    "Agency";
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
  return (
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
            <em>{c.status}</em>
          </button>
        ))}
        {!rows.length && (
          <p>
            No agent conversations yet. New WhatsApp and Instagram messages will
            appear here.
          </p>
        )}
      </aside>
      <section className="agent-chat">
        {active ? (
          <>
            <header>
              <div>
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
              <div>
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
              </div>
            </header>
            <div className="agent-messages">
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
                        packages.find((p) => p.id === a.payload.packageId)?.data
                          .name ||
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
                        Approve & send
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
        {active ? (
          <>
            <label>
              Creator<strong>{String(creator(active.influencer_id))}</strong>
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
              Summary
              <p>
                {active.summary || "The agent is still collecting details."}
              </p>
            </label>
          </>
        ) : (
          <p>No conversation selected.</p>
        )}
      </aside>
    </div>
  );
}
