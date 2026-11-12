import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simultaneous",
  description: "Jam entre Spotify e Deezer: cada um ouve no seu app, todos na mesma música.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#0b0b10" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
