import { useState } from "react";
import type { FormEvent } from "react";
import knaufLogo from "./assets/knauf-logo.png";
import { offices } from "./data";

type Mode = "login" | "signup";

export default function Login({
  checking,
  onSubmit,
}: {
  checking: boolean;
  onSubmit: (mode: Mode, form: FormData) => Promise<string | null>;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || checking) return;
    setBusy(true);
    setError("");
    const result = await onSubmit(mode, new FormData(event.currentTarget));
    if (result) {
      setError(result);
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <img src={knaufLogo} alt="KNAUF" className="login-logo" />
        <p className="login-sub">2026 CI KAiZEN CIRCLE</p>
        <form key={mode} onSubmit={submit}>
          {mode === "signup" && (
            <>
              <label>
                이름
                <input
                  name="name"
                  required
                  maxLength={40}
                  autoComplete="name"
                />
              </label>
              <label>
                사무소
                <select name="department" required defaultValue="">
                  <option value="" disabled>
                    선택
                  </option>
                  {offices.map((office) => (
                    <option key={office} value={office}>
                      {office}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            계정
            <input
              name="account"
              required
              minLength={2}
              maxLength={20}
              pattern="\S+"
              title="공백 없이 2~20자"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
            />
          </label>
          <label>
            비밀번호
            <input
              name="password"
              type="password"
              required
              minLength={mode === "signup" ? 6 : undefined}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full-width" disabled={busy || checking}>
            {checking
              ? "확인 중..."
              : busy
                ? "처리 중..."
                : mode === "login"
                  ? "로그인"
                  : "계정 등록"}
          </button>
        </form>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "계정 등록" : "로그인으로 돌아가기"}
        </button>
      </div>
    </main>
  );
}
