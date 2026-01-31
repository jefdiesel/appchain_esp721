import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your Chainhost names, sites, and tokens. View your on-chain assets and deployments.",
  openGraph: {
    title: "Dashboard | Chainhost",
    description: "Manage your Chainhost names, sites, and tokens.",
    url: "/dashboard",
  },
  twitter: {
    title: "Dashboard | Chainhost",
    description: "Manage your Chainhost names, sites, and tokens.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
