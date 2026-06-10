import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";
import AppShell from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sbjiwala.in — Fresh Vegetables & Fruits in 10 Minutes",
    template: "%s | Sbjiwala.in",
  },
  description:
    "Order fresh farm vegetables & fruits online. Get hygienic, cleaned produce delivered at your doorstep in 10 minutes. Direct from local farms.",
  keywords: ["vegetables", "fruits", "grocery", "fresh produce", "online vegetables", "home delivery", "Sbjiwala"],
  authors: [{ name: "Sbjiwala", url: "https://sbjiwala.qzz.io" }],
  metadataBase: new URL("https://sbjiwala.qzz.io"),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://sbjiwala.qzz.io",
    siteName: "Sbjiwala.in",
    title: "Sbjiwala.in — Fresh Vegetables & Fruits in 10 Minutes",
    description: "Get fresh farm produce delivered at your doorstep in 10 minutes.",
    images: [{ url: "/logo_horizontal.png", width: 1200, height: 630, alt: "Sbjiwala.in" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sbjiwala.in — Fresh Vegetables & Fruits in 10 Minutes",
    description: "Get fresh farm produce delivered at your doorstep in 10 minutes.",
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
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
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
