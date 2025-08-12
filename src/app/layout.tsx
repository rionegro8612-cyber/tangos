import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tango",
  description: "Senior social MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white text-black">{children}</body>
    </html>
  );
}

