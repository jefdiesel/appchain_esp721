"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import UsernameSelector from "@/components/UsernameSelector";

interface OnboardingClientProps {
  initialSuggestion?: string;
}

export default function OnboardingClient({ initialSuggestion }: OnboardingClientProps) {
  const router = useRouter();

  const handleClaimed = (username: string) => {
    // Redirect to dashboard after claiming
    router.push(`/dashboard?welcome=true&username=${username}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            <span className="text-white">CHAIN</span>
            <span className="text-[#C3FF00]">HOST</span>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Chainhost</h1>
          <p className="text-gray-500 mb-8">
            Choose a username for your free subdomain
          </p>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8">
            <UsernameSelector
              onClaimed={handleClaimed}
              initialSuggestion={initialSuggestion}
            />
          </div>

          <p className="mt-6 text-sm text-gray-600">
            Your username will be your subdomain: <span className="text-gray-400">username.chainhost.online</span>
          </p>
        </div>
      </main>
    </div>
  );
}
