import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Name",
  description: "Claim a permanent name on Ethereum. First come, first served, forever yours. Register your ethscription name on Chainhost.",
  openGraph: {
    title: "Register Name | Chainhost",
    description: "Claim a permanent name on Ethereum. First come, first served, forever yours.",
    url: "/register",
  },
  twitter: {
    title: "Register Name | Chainhost",
    description: "Claim a permanent name on Ethereum. First come, first served, forever yours.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
