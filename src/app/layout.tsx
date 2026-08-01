import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const sans = Source_Sans_3({
  variable: "--font-sans-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Golf AI",
  description: "AI-powered golf swing analysis from slow-motion video uploads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${display.variable} ${sans.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
