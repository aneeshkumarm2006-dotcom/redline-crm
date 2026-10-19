import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { publicInventoryCopy } from "@/modules/inventory/public-copy";

export const metadata: Metadata = {
  title: publicInventoryCopy.available,
  description: publicInventoryCopy.intro,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

// UI text, geometric display face for headlines and big figures, mono for VINs and stock numbers.
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const display = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable} h-full font-sans antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
