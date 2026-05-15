import type { Metadata, Viewport } from "next";
import { Saira_Condensed } from "next/font/google";

import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// Saira Condensed — fallback gratuito da Centrifuge oficial (identidade JCN).
// Centrifuge é paga; substituir quando licenciar.
const sairaCondensed = Saira_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-saira",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CRM JCN — JCN Construction Inc.",
  description: "Pipeline interno de leads e jobs da JCN Construction Inc.",
  applicationName: "CRM JCN",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "CRM JCN",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#10171E", // azul meia noite JCN
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${sairaCondensed.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans text-foreground">
        {children}
        <Toaster position="top-center" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
