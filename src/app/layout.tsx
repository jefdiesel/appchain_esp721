import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Chainhost - Host Sites on Ethereum",
    template: "%s | Chainhost",
  },
  description: "Build and host websites permanently on Ethereum calldata. No servers, no renewals, no takedowns.",
  icons: {
    icon: "/favicon.png",
  },
  metadataBase: new URL("https://chainhost.online"),
  openGraph: {
    type: "website",
    siteName: "Chainhost",
    title: "Chainhost - Host Sites on Ethereum",
    description: "Build and host websites permanently on Ethereum calldata. No servers, no renewals, no takedowns.",
    url: "https://chainhost.online",
    images: [{ url: "/favicon.png", width: 256, height: 256 }],
  },
  twitter: {
    card: "summary",
    title: "Chainhost - Host Sites on Ethereum",
    description: "Build and host websites permanently on Ethereum calldata. No servers, no renewals, no takedowns.",
    images: ["/favicon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-gray-400`}
      >
        {children}
      </body>
    </html>
  );
}
