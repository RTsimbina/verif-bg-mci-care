import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vérification BG — MCI CARE MADAGASCAR",
  description: "Détection automatique des écritures comptables incorrectes et génération des écritures de transfert 580001 (comptes à comptes).",
  keywords: ["comptabilité", "MCI CARE", "Madagascar", "vérification BG", "580001", "comptes à comptes", "512", "brouillard", "Sage"],
  authors: [{ name: "MCI CARE MADAGASCAR" }],
  openGraph: {
    title: "Vérification BG — MCI CARE MADAGASCAR",
    description: "Détection automatique des écritures incorrectes et génération des transferts 580001",
    url: "https://rtsimbina.github.io/verif-bg-mci-care/",
    siteName: "Vérification BG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vérification BG — MCI CARE MADAGASCAR",
    description: "Détection automatique des écritures incorrectes et génération des transferts 580001",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
