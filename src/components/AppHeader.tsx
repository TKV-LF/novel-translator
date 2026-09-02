"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import clsx from "clsx";

const LINKS = [
  { href: "/thu-vien", label: "Thư viện" },
  { href: "/them", label: "Thêm" },
  { href: "/cai-dat", label: "Cài đặt" },
];

export function AppHeader({ username }: { username?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/dang-nhap");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }, [router]);

  if (pathname?.startsWith("/dang-nhap")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/thu-vien"
          className="font-serif text-lg tracking-wide text-amber-100"
        >
          Dịch Truyện
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "rounded px-2.5 py-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-slate-50",
                pathname?.startsWith(link.href) && "bg-slate-800 text-amber-100"
              )}
            >
              {link.label}
            </Link>
          ))}
          {username ? (
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className="ml-1 rounded px-2.5 py-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50"
            >
              {loggingOut ? "…" : username}
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
