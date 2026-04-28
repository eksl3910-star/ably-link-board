import type { Metadata } from "next";
import "./globals.css";
import MaintenanceGate from "@/app/components/MaintenanceGate";

export const metadata: Metadata = {
  title: "에이블리 링크 공유",
  description: "에이블리 링크 보드 클론"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <MaintenanceGate>{children}</MaintenanceGate>
      </body>
    </html>
  );
}
