import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "Ponto Eletrônico — MeuPonto",
  description:
    "Sistema de Ponto Eletrônico Digital: registre sua jornada com geolocalização, histórico, espelho de ponto e modo offline.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", type: "image/png" },
      { url: "/icons/icon-512.png", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MeuPonto",
  },
};

export const viewport: Viewport = {
  themeColor: "#141838",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="aurora" aria-hidden="true">
          <div className="aurora-blob b1" />
          <div className="aurora-blob b2" />
          <div className="aurora-blob b3" />
        </div>
        <div id="app-frame">{children}</div>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
