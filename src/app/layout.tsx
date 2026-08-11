import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Cormorant_Garamond, Lora } from "next/font/google";
import { isAuthDisabled } from "@/lib/auth-mode";
import { THEME_INIT_SCRIPT } from "@/components/theme-toggle";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const sans = Lora({
  variable: "--font-sans-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Grip Intelligence · AI Golfing Coach",
  description: "AI-powered golf swing analysis from slow-motion video uploads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shell = (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme class before first paint — see THEME_INIT_SCRIPT. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${display.variable} ${sans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );

  // With the dev bypass on, mounting ClerkProvider would still try to reach
  // Clerk (and can redirect-loop on stale cookies), so skip it entirely.
  if (isAuthDisabled()) return shell;

  return <ClerkProvider>{shell}</ClerkProvider>;
}
