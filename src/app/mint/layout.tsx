import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Token Launcher",
  description: "Launch an Ethereum bonding curve token tied to your ethscription name. Polynomial curve, auto-migration to Uniswap V2.",
  openGraph: {
    title: "Token Launcher | Chainhost",
    description: "Launch an Ethereum bonding curve token tied to your ethscription name. Auto-migrates to Uniswap V2.",
    url: "/mint",
  },
  twitter: {
    title: "Token Launcher | Chainhost",
    description: "Launch an Ethereum bonding curve token tied to your ethscription name.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
