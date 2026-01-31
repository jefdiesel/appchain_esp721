import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upload Site",
  description: "Upload HTML to Ethereum calldata. Your website lives forever on-chain — no servers, no renewals, no takedowns.",
  openGraph: {
    title: "Upload Site | Chainhost",
    description: "Upload HTML to Ethereum calldata. Your website lives forever on-chain.",
    url: "/upload",
  },
  twitter: {
    title: "Upload Site | Chainhost",
    description: "Upload HTML to Ethereum calldata. Your website lives forever on-chain.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
