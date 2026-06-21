import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import Providers from "./providers";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: {
    default: "Sbjiwala - Kisan ke Ghar Se Apke Ghar tak — Fresh Vegetables & Fruits in Instant",
    template: "%s | Sbjiwala - Kisan ke Ghar Se Apke Ghar tak",
  },
  description:
    "Order fresh farm vegetables & fruits online. Get hygienic, cleaned produce delivered at your doorstep in Instant. Direct from local farms.",
  keywords: ["vegetables", "fruits", "grocery", "fresh produce", "online vegetables", "home delivery", "Sbjiwala"],
  authors: [{ name: "Sbjiwala", url: "https://sbjiwala.qzz.io" }],
  metadataBase: new URL("https://sbjiwala.qzz.io"),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://sbjiwala.qzz.io",
    siteName: "Sbjiwala - Kisan ke Ghar Se Apke Ghar tak",
    title: "Sbjiwala - Kisan ke Ghar Se Apke Ghar tak — Fresh Vegetables & Fruits in Instant",
    description: "Get fresh farm produce delivered at your doorstep in Instant.",
    images: [{ url: "/logo_horizontal.png", width: 1200, height: 630, alt: "Sbjiwala - Kisan ke Ghar Se Apke Ghar tak" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sbjiwala - Kisan ke Ghar Se Apke Ghar tak — Fresh Vegetables & Fruits in Instant",
    description: "Get fresh farm produce delivered at your doorstep in Instant.",
    images: ["/logo_horizontal.png"],
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sbjiwala",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192x192.png" }],
  },
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
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className="h-full"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --font-inter: 'Inter', sans-serif;
          }
        `}} />
        <Script
          id="theme-loader"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('sw_theme') ||
                  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.classList.remove('dark','amoled');
                if (theme === 'dark') document.documentElement.classList.add('dark');
                else if (theme === 'amoled') document.documentElement.classList.add('dark','amoled');
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col antialiased" style={{ fontFamily: "var(--font-inter, Inter, system-ui, sans-serif)" }}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .catch(function(err) { console.warn('SW reg failed:', err); });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
