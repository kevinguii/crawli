import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecrawli.com";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Crawli: Compare Secondhand & Vintage Prices Everywhere",
    template: "%s · Crawli",
  },
  description:
    "Search Grailed, Depop, Poshmark, StockX, Mercari, Vinted & eBay at once to find the real price on any secondhand or vintage piece, plus a flip margin calculator for resellers.",
  applicationName: "Crawli",
  keywords: [
    "secondhand fashion price comparison",
    "vintage clothing search",
    "compare resale prices",
    "cross-platform price comparison",
    "reseller sourcing tool",
    "find underpriced inventory",
    "resale margin calculator",
    "flip margin after fees",
    "search all resale sites at once",
    "Grailed Depop Poshmark StockX Mercari Vinted eBay",
    "streetwear resale sourcing",
    "sneaker resale comp",
  ],
  authors: [{ name: "Crawli" }],
  creator: "Crawli",
  publisher: "Crawli",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/`,
    siteName: "Crawli",
    title: "Crawli: Compare Secondhand & Vintage Prices Everywhere",
    description:
      "One search across Grailed, Depop, Poshmark, StockX, Mercari, Vinted & eBay to find the real price on any secondhand or vintage piece, plus a flip margin calculator for resellers.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crawli: Compare Secondhand & Vintage Prices Everywhere",
    description:
      "One search across every resale marketplace to find the real price on any secondhand or vintage piece, plus a flip margin calculator for resellers.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: process.env.NEXT_PUBLIC_GSC_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};

// Inline script runs before paint to avoid theme flash.
const themeInit = `(function(){try{var s=localStorage.getItem('theme');var t=s==='light'?'light':s==='dark'?'dark':window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Crawli Blog"
          href="/feed.xml"
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        {GA_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
