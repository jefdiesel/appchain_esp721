import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Name Marketplace",
  description: "Buy and sell ethscription names with trustless escrow. No middlemen, instant transfers on Ethereum.",
  openGraph: {
    title: "Name Marketplace | Chainhost",
    description: "Buy and sell ethscription names with trustless escrow. No middlemen, instant transfers.",
    url: "/marketplace",
  },
  twitter: {
    title: "Name Marketplace | Chainhost",
    description: "Buy and sell ethscription names with trustless escrow on Ethereum.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
