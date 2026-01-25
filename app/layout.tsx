import "./globals.css";
import type { Metadata } from "next";
import TopNav from "@/components/TopNav";

export const metadata: Metadata = {
  title: "RadAssist - Radiology Assistant",
  description: "Yapılandırılmış Radyoloji Raporlama ve Karar Destek Sistemi",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">
        <TopNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
