import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resolve Name",
  description: "Look up any ethscription name to find its owner and browse their on-chain holdings.",
  openGraph: {
    title: "Resolve Name | Chainhost",
    description: "Look up any ethscription name to find its owner and browse their on-chain holdings.",
    url: "/resolve",
  },
  twitter: {
    title: "Resolve Name | Chainhost",
    description: "Look up any ethscription name to find its owner and browse their holdings.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
