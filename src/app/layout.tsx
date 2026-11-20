import type { Metadata, Viewport } from "next";
import { Inter, Pixelify_Sans } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import { NeonCity } from "@/components/ui/neon-city";
import "./globals.css";

// Fonts are downloaded at build time and self-hosted — no runtime requests to Google.
const pixel = Pixelify_Sans({ variable: "--font-pixel", subsets: ["latin"], weight: ["500", "700"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LIFEQUEST",
  description: "Your life, forged into an epic quest.",
  applicationName: "LIFEQUEST",
  appleWebApp: { capable: true, title: "LIFEQUEST", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0c0618",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${pixel.variable} ${inter.variable} h-full bg-obsidian-950 antialiased`}>
      <body className="min-h-full flex flex-col">
        <NeonCity />
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
