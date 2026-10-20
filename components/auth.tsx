"use client";

/* Supplied brand assets use their original files. */
/* eslint-disable @next/next/no-img-element */
/* Auth and logout need a full document navigation to refresh HTTP-only sessions. */
import { readJson } from "@/lib/json";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

type AuthField = "name" | "email" | "password";
type FieldErrors = Partial<Record<AuthField, string>>;

export default function Auth({ mode }: { mode: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">(
    "success",
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");

  const heading: Record<string, string> = {
    login: "Welcome back.",
    signup: "Join the den.",
    forgot: "Let’s get you back in.",
    reset: "Set a new password.",
    verify: "Verify your email.",
    invite: "Your invitation awaits.",
  };

  async function request(path: string, data: unknown) {
    const response = await fetch("/api/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await readJson(response);
    if (!response.ok) throw new Error(result.error);
    return result;
  }

  function clearFieldError(field: AuthField) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate(data: Record<string, FormDataEntryValue>): FieldErrors {
    const errors: FieldErrors = {};
    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    const password = String(data.password || "");

    if (mode === "signup") {
      if (!name) errors.name = "Full name is required.";
      else if (name.length < 2)
        errors.name = "Name must be at least 2 characters.";
    }
    if (["login", "signup", "forgot", "verify"].includes(mode)) {
      if (!email) errors.email = "Email address is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        errors.email = "Please enter a valid email address.";
    }
    if (["login", "signup", "reset"].includes(mode)) {
      if (!password) errors.password = "Password is required.";
      else if (mode !== "login" && password.length < 8)
        errors.password = "Password must be at least 8 characters.";
    }
    return errors;
  }

  useEffect(() => {
    queueMicrotask(() => {
      setInviteSearch(window.location.search);
      fetch("/api/auth/config")
        .then((response) => readJson(response))
        .then((result) => setConfigured(result.configured));
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      if (fragment.has("access_token")) {
        setBusy(true);
        request("auth/session", {
          access_token: fragment.get("access_token"),
          refresh_token: fragment.get("refresh_token"),
        })
          .then(() => {
            history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search,
            );
            setReady(true);
            setMessageType("success");
            setMessage(
              mode === "reset"
                ? "Your recovery link is verified. Choose a new password."
                : "Your email is verified. You can enter the portal.",
            );
          })
          .catch((error) => {
            setMessageType("error");
            setMessage(error.message);
          })
          .finally(() => setBusy(false));
      } else setReady(true);
    });
  }, [mode]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const errors = validate(data);
    setFieldErrors(errors);
    setMessage("");
    if (Object.keys(errors).length) return;

    setBusy(true);
    try {
      const result =
        mode === "invite"
          ? await request("invite/accept", {
              token: new URLSearchParams(window.location.search).get("token"),
            })
          : await request(
              "auth/" +
                (mode === "forgot"
                  ? "recover"
                  : mode === "reset"
                    ? "password"
                    : mode === "verify"
                      ? "resend"
                      : mode),
              data,
            );
      setMessageType("success");
      setMessage(result.message || "Saved successfully.");
      if (["login", "reset", "invite"].includes(mode)) {
        const destination = new URLSearchParams(window.location.search).get(
          "next",
        );
        window.location.assign(
          destination?.startsWith("/auth/invite?token=")
            ? destination
            : "/dashboard",
        );
      }
    } catch (error) {
      const errorText =
        (error as Error).message || "This action could not be completed.";
      const lower = errorText.toLowerCase();
      if (lower.includes("password")) setFieldErrors({ password: errorText });
      else if (lower.includes("email")) setFieldErrors({ email: errorText });
      else {
        setMessageType("error");
        setMessage(errorText);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <div className="auth-story">
        <Link href="/">
          <img src="/brand/logo.png" alt="Inspirers’ Den official logo" />
        </Link>
        <div>
          <span className="eyebrow">YOUR CREATIVE WORKSPACE</span>
          <h1>
            Every connection.
            <br />
            <em>One place.</em>
          </h1>
          <p>
            Creators, collaborations and the details that bring great work
            together.
          </p>
        </div>
        <span className="caption">INSPIRERS’ DEN · AGENCY PORTAL</span>
      </div>
      <div className="auth-panel">
        <Link href="/" className="back-link">
          Back to website
        </Link>
        <div>
          <ShieldCheck className="auth-icon" />
          <h2>{heading[mode] || heading.login}</h2>
          <p>
            {mode === "invite"
              ? "Sign in with the invited email before accepting."
              : "Your next collaboration starts here."}
          </p>
          {mode === "invite" && (
            <Link
              className="btn outline"
              href={
                "/auth/login?next=" +
                encodeURIComponent("/auth/invite" + inviteSearch)
              }
            >
              Sign in with invited email
            </Link>
          )}
          {configured === false && (
            <div className="setup-note">
              <strong>Email authentication setup required</strong>
              <p>
                Set SUPABASE_URL, SUPABASE_ANON_KEY and AGENCY_OWNER_EMAIL in
                .env.local, then restart the server. See the setup guide for
                email verification and redirect URLs.
              </p>
            </div>
          )}
          <form onSubmit={submit} noValidate>
            {mode === "signup" && (
              <label>
                Full name
                <input
                  name="name"
                  minLength={2}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                  onChange={() => clearFieldError("name")}
                />
                {fieldErrors.name && (
                  <small id="name-error" className="field-error" role="alert">
                    {fieldErrors.name}
                  </small>
                )}
              </label>
            )}
            {["login", "signup", "forgot", "verify"].includes(mode) && (
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email ? "email-error" : undefined
                  }
                  onChange={() => clearFieldError("email")}
                />
                {fieldErrors.email && (
                  <small id="email-error" className="field-error" role="alert">
                    {fieldErrors.email}
                  </small>
                )}
              </label>
            )}
            {["login", "signup", "reset"].includes(mode) && (
              <label>
                Password
                <input
                  type="password"
                  name="password"
                  minLength={mode === "login" ? 1 : 8}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password ? "password-error" : undefined
                  }
                  onChange={() => clearFieldError("password")}
                />
                {fieldErrors.password ? (
                  <small
                    id="password-error"
                    className="field-error"
                    role="alert"
                  >
                    {fieldErrors.password}
                  </small>
                ) : (
                  mode !== "login" && <small>At least 8 characters.</small>
                )}
              </label>
            )}
            {message && (
              <p className={`form-message ${messageType}`} role="status">
                {message}
              </p>
            )}
            <button
              className="btn charcoal"
              disabled={
                busy || !ready || (configured === false && mode !== "invite")
              }
            >
              {busy
                ? "Please wait…"
                : mode === "verify"
                  ? "Resend verification email"
                  : mode === "invite"
                    ? "Accept invitation"
                    : mode === "forgot"
                      ? "Send recovery link"
                      : mode === "reset"
                        ? "Update password"
                        : mode === "signup"
                          ? "Create account"
                          : "Sign in"}
            </button>
          </form>
          {mode === "verify" && (
            <Link className="btn charcoal" href="/dashboard">
              Enter the portal
            </Link>
          )}
          {mode === "login" && (
            <div className="auth-links">
              <Link href="/auth/forgot">Forgot password?</Link>
              <span>
                New here? <Link href="/auth/signup">Create account</Link>
              </span>
            </div>
          )}
          <p className="caption">
            Team access and creator permissions are managed by the agency.
          </p>
        </div>
      </div>
    </main>
  );
}
