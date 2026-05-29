import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SentryProvider } from "./sentry-provider";

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
    default:
      "Crawli — Compare Resale Prices Across 8 Marketplaces in One Search",
    template: "%s · Crawli",
  },
  description:
    "Crawli searches Grailed, Depop, Poshmark, StockX, Mercari, Vinted, eBay & Vestiaire at once, so you can compare secondhand fashion prices and find the best deal without checking eight apps.",
  applicationName: "Crawli",
  keywords: [
    "compare resale prices",
    "resale price comparison",
    "secondhand fashion search",
    "preloved clothing search engine",
    "vintage fashion deals",
    "search all resale sites at once",
    "Grailed Depop Poshmark StockX Mercari Vinted eBay Vestiaire",
    "best place to buy secondhand designer",
    "streetwear resale search",
    "sneaker resale price comparison",
  ],
  authors: [{ name: "Crawli" }],
  creator: "Crawli",
  publisher: "Crawli",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Crawli",
    title: "Crawli — Compare Resale Prices Across 8 Marketplaces in One Search",
    description:
      "One search across Grailed, Depop, Poshmark, StockX, Mercari, Vinted, eBay & Vestiaire. Compare secondhand fashion prices and find the best deal instantly.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crawli — Compare Resale Prices Across 8 Marketplaces",
    description:
      "One search across 8 resale marketplaces. Compare secondhand fashion prices and find the best deal instantly.",
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
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SentryProvider>{children}</SentryProvider>
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
