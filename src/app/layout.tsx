import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Londra Camping Otopark",
    template: "%s · Londra Camping Otopark",
  },
  description: "Londra Camping Otopark işletme yönetim sistemi.",
  robots: { index: false, follow: false }, // panel indekslenmez; public site kendi metadata'sini verir
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale ayarlanmaz: kullanicinin yakinlastirma hakki kisitlanmamali.
  themeColor: "#0b2447",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
