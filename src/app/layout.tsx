import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Providers } from "@/components/providers";
import { SearchDialog } from "@/components/search-dialog";
import { ToastProvider } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Second Brain",
  description: "个人知识管理平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-[var(--background)] text-[var(--foreground)]">
        <Providers>
          <ToastProvider>
            <div className="flex h-full bg-[var(--background)]">
              <Sidebar />
              <main className="min-w-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.88),rgba(251,251,250,1)_32%)] px-4 py-5 md:px-6 md:py-6 dark:bg-[radial-gradient(circle_at_top,rgba(38,38,38,0.96),rgba(25,25,25,1)_36%)] dark:text-stone-100">
                {children}
              </main>
              <SearchDialog />
            </div>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
