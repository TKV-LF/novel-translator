"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

export default function DangNhapPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError("");
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          mode === "login" ? "/api/auth/login" : "/api/auth/register",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              mode === "login"
                ? { username, password }
                : { username, password, inviteCode }
            ),
          }
        );
        const data = (await res.json()) as { message?: string };
        if (!res.ok) {
          setError(data.message || "Có lỗi xảy ra");
          return;
        }
        router.push("/thu-vien");
        router.refresh();
      } catch {
        setError("Không kết nối được máy chủ");
      } finally {
        setLoading(false);
      }
    },
    [mode, username, password, inviteCode, router]
  );

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <h1 className="font-serif text-3xl text-amber-100">Dịch Truyện</h1>
      <p className="mt-2 text-sm text-slate-400">
        Đọc tiểu thuyết Trung → Việt cùng bạn bè.
      </p>

      <form onSubmit={onSubmit} className="panel mt-8 space-y-4 p-5">
        <h2 className="text-lg font-medium">
          {mode === "login" ? "Đăng nhập" : "Đăng ký"}
        </h2>
        <div>
          <label className="label" htmlFor="username">
            Tên đăng nhập
          </label>
          <input
            id="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={2}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={4}
          />
        </div>
        {mode === "register" ? (
          <div>
            <label className="label" htmlFor="inviteCode">
              Mã mời
            </label>
            <input
              id="inviteCode"
              className="input"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoComplete="off"
              required
              placeholder="Nhập mã mời từ admin"
            />
          </div>
        ) : null}
        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading
            ? "Đang xử lý…"
            : mode === "login"
              ? "Đăng nhập"
              : "Tạo tài khoản"}
        </button>
        <button
          type="button"
          onClick={toggleMode}
          className="w-full text-center text-sm text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
        >
          {mode === "login"
            ? "Chưa có tài khoản? Đăng ký"
            : "Đã có tài khoản? Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
