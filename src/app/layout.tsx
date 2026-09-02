import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Serif } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import { Providers } from "@/components/Providers";
import { requireAuth } from "@/lib/auth/session";
import "./globals.css";

const uiFont = Noto_Sans({
  variable: "--font-ui",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const readingFont = Noto_Serif({
  variable: "--font-reading",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700"],
});

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
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: LayoutProps<"/">) {
  const user = await requireAuth();

  return (
    <html
      lang="vi"
      className={`${uiFont.variable} ${readingFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <AppHeader username={user?.username} />
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
