import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AdminAuthProvider } from "@/lib/admin-auth-context";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Baciraro Admin",
  description: "Panel admin Baciraro",
  applicationName: "Baciraro Admin",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Baciraro",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-screen">
        <ServiceWorkerRegister />
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
