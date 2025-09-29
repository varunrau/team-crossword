import type { Metadata } from "next";
import { Instrument_Serif, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"]
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Team Crossword",
  description: "Collaborative crossword puzzle game for teams",
  keywords: ["crossword", "puzzle", "team", "collaborative", "game"],
  authors: [{ name: "Team Crossword" }],
  openGraph: {
    title: "Team Crossword",
    description: "Collaborative crossword puzzle game for teams",
    url: "https://team-crossword.vercel.app",
    siteName: "Team Crossword",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Team Crossword - Collaborative puzzle game",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Team Crossword",
    description: "Collaborative crossword puzzle game for teams",
    images: ["/og-image.png"],
    creator: "@teamcrossword",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sourceSans.variable} ${instrumentSerif.variable}`}>
        {children}
      </body>
    </html>
  );
}
