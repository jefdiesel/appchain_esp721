import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Sites",
  description: "Browse websites recently deployed on Chainhost. See what people are building on Ethereum calldata.",
  openGraph: {
    title: "Live Sites | Chainhost",
    description: "Browse websites recently deployed on Chainhost — permanent sites on Ethereum.",
    url: "/feed",
  },
  twitter: {
    title: "Live Sites | Chainhost",
    description: "Browse websites recently deployed on Chainhost.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
