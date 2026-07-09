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
    default: "Crawli: Reseller Sourcing Tool & Margin Calculator",
    template: "%s · Crawli",
  },
  description:
    "Search Grailed, Depop, Poshmark, StockX, Mercari, Vinted & eBay at once. Find underpriced inventory and calculate your flip margin after fees before you buy.",
  applicationName: "Crawli",
  keywords: [
    "reseller sourcing tool",
    "find underpriced inventory",
    "resale margin calculator",
    "cross-platform price comparison",
    "flip margin after fees",
    "search all resale sites at once",
    "Grailed Depop Poshmark StockX Mercari Vinted eBay",
    "sourcing intelligence for resellers",
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
    title: "Crawli: Reseller Sourcing Tool & Margin Calculator",
    description:
      "One search across Grailed, Depop, Poshmark, StockX, Mercari, Vinted & eBay. Find underpriced inventory, see the real comp, and know your flip margin after fees before you buy.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crawli: Sourcing Intelligence for Resellers",
    description:
      "One search across every resale marketplace. Find underpriced inventory and know your flip margin after fees before you buy.",
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
