import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Procure.job",
  description: "IA que encontra vagas e prepara suas candidaturas.",
  manifest: "/manifest.json",
  applicationName: "Procure.job",
  appleWebApp: {
    capable: true,
    title: "Procure.job",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-app.svg",
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Permite que o conteúdo ocupe a tela toda (atrás do notch); o safe-area
  // é tratado no CSS. Deixa o app com cara de tela cheia no celular.
  viewportFit: "cover",
  themeColor: "#3398db",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">{children}</body>
    </html>
  );
}
