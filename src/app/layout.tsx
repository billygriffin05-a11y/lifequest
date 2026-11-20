import type { Metadata, Viewport } from "next";
import { Inter, Orbitron } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

// Fonts are downloaded at build time and self-hosted — no runtime requests to Google.
const orbitron = Orbitron({ variable: "--font-orbitron", subsets: ["latin"], weight: ["500", "700"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LIFEQUEST",
  description: "Your life, forged into an epic quest.",
  applicationName: "LIFEQUEST",
  appleWebApp: { capable: true, title: "LIFEQUEST", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#04060d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${orbitron.variable} ${inter.variable} h-full bg-obsidian-950 antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
