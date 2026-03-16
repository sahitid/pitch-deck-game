import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "PITCH DECK — The Startup Card Game",
  description:
    "A party game where players combine startup cards into absurd pitches. Free, no sign-up, pass-and-play.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🃏</text></svg>",
  },
};

export const viewport: Viewport = {
  themeColor: "#1b3a2a",
  width: "device-width",
  initialScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
    >
      <body className="h-full overflow-hidden font-sans antialiased table-felt text-cream">
        {/* Vignette */}
        <div
          className="fixed inset-0 pointer-events-none z-[1]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(0,0,0,0.35) 100%)",
          }}
        />
        <div className="relative z-10 h-full">{children}</div>
      </body>
    </html>
  );
}
