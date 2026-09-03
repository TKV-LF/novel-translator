import type { Metadata, Viewport } from "next";
import { AppHeader } from "@/components/AppHeader";
import { Providers } from "@/components/Providers";
import { requireAuth } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dịch Truyện — Trung → Việt",
  description:
    "Đọc tiểu thuyết Trung Quốc dịch Việt, chuyển chương liên tục, PWA.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dịch Truyện",
  },
};

export const viewport: Viewport = {
  themeColor: "#272729",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: LayoutProps<"/">) {
  const user = await requireAuth();

  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <AppHeader username={user?.username} />
          <main className="app-main app-width mx-auto w-full flex-1">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
