import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Küa Locale",
    template: "%s · Küa Locale",
  },
  description:
    "Gestion des Google Business Profiles des clients de l'agence Küa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr-CA" className="dark">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
