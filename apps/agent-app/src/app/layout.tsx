import type { Metadata, Viewport } from "next";
import "./globals.css";

import { AppUpdater, StatusBarInit } from "@sbjiwala/shared";
import Providers from "./providers";
import versionInfo from "./version.json";

export const metadata: Metadata = {
  title: "Sbjiwala Agent Support Console",
  description: "Dedicated workspace for Sbjiwala customer support agents.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#10b981" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Providers>
          <StatusBarInit />
          {children}
          <AppUpdater appName="agent" currentVersion={versionInfo.version} />
        </Providers>
      </body>
    </html>
  );
}
