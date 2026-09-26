import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

const display = Big_Shoulders({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-big-shoulders",
});
const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans-body",
});

export const metadata: Metadata = {
  title: { default: "Flutlicht", template: "%s · Flutlicht" },
  description: "Private Bundesliga-Managerrunde",
  manifest: "/manifest.json",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    title: "Flutlicht",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1c26",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster theme="dark" position="top-center" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
