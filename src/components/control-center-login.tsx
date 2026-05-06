"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ControlCenterLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("Private access only.");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("Signing in...");

    try {
      const response = await fetch("/api/control-center/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Sign in failed.");
      }

      setMessage("Access granted.");
      router.push("/control-center");
      router.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sign in failed.";
      setMessage(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell control-center-page">
      <section className="auth-shell panel" data-reveal="fade">
        <div className="auth-brand">
          <Image
            src="/branding/logo.png"
            alt="KDUB Beats logo"
            className="brand-mark"
            width={72}
            height={72}
            priority
          />
          <div>
            <p className="eyebrow">Private Access</p>
            <h1 className="hero-title">Studio Session</h1>
            <p className="hero-text">
              Sign in with your private credentials.
            </p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Access Name
            <input value={username} onChange={(event) => setUsername(event.target.value)} required />
          </label>
          <label>
            Passcode
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="button button-primary full-width" type="submit" disabled={submitting}>
            {submitting ? "Signing In..." : "Unlock Session"}
          </button>
          <p className="config-banner">{message}</p>
        </form>
      </section>
    </main>
  );
}
