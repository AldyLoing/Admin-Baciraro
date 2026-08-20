import type { Metadata } from "next";
import "./globals.css";
import { AdminAuthProvider } from "@/lib/admin-auth-context";

export const metadata: Metadata = {
  title: "Baciraro Admin",
  description: "Panel admin Baciraro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-screen">
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}