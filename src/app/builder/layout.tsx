import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Site Builder",
  description: "Build your on-chain website with the Chainhost visual builder. Deploy HTML directly to Ethereum calldata.",
  openGraph: {
    title: "Site Builder | Chainhost",
    description: "Build your on-chain website with the Chainhost visual builder.",
    url: "/builder",
  },
  twitter: {
    title: "Site Builder | Chainhost",
    description: "Build your on-chain website with the Chainhost visual builder.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
