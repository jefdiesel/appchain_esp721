"use client";

import { useState, useEffect, useCallback } from "react";

interface UsernameSelectorProps {
  onClaimed: (username: string) => void;
  initialSuggestion?: string;
}

export default function UsernameSelector({ onClaimed, initialSuggestion }: UsernameSelectorProps) {
  const [username, setUsername] = useState(initialSuggestion || "");
  const [isChecking, setIsChecking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [availability, setAvailability] = useState<{
    available?: boolean;
    error?: string;
    suggestions?: string[];
  } | null>(null);

  // Debounced availability check
  const checkAvailability = useCallback(async (value: string) => {
    if (value.length < 2) {
      setAvailability({ available: false, error: "Username must be at least 2 characters" });
      return;
    }

    setIsChecking(true);
    try {
      const res = await fetch(`/api/username/check?username=${encodeURIComponent(value)}`);
      const data = await res.json();
      setAvailability(data);
    } catch {
      setAvailability({ available: false, error: "Failed to check availability" });
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (username.length >= 2) {
        checkAvailability(username);
      } else if (username.length > 0) {
        setAvailability({ available: false, error: "Username must be at least 2 characters" });
      } else {
        setAvailability(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username, checkAvailability]);

  const handleClaim = async () => {
    if (!availability?.available) return;

    setIsClaiming(true);
    try {
      const res = await fetch("/api/username/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();
      if (data.success) {
        onClaimed(data.username);
      } else {
        setAvailability({ available: false, error: data.error });
      }
    } catch {
      setAvailability({ available: false, error: "Failed to claim username" });
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <label className="block text-sm text-gray-400 mb-2">Choose your username</label>

      <div className="relative">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-white focus:outline-none pr-12 ${
            availability?.available
              ? "border-[#C3FF00]"
              : availability?.error
              ? "border-red-500"
              : "border-zinc-800 focus:border-zinc-600"
          }`}
          placeholder="username"
          maxLength={20}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {isChecking ? (
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          ) : availability?.available ? (
            <svg className="w-5 h-5 text-[#C3FF00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : availability?.error ? (
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : null}
        </div>
      </div>

      {/* Preview subdomain */}
      {username && (
        <div className="mt-2 text-sm text-gray-500">
          Your site: <span className="text-gray-300 font-mono">{username}.chainhost.online</span>
        </div>
      )}

      {/* Error message */}
      {availability?.error && (
        <div className="mt-2 text-sm text-red-400">{availability.error}</div>
      )}

      {/* Suggestions */}
      {availability?.suggestions && availability.suggestions.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-gray-500 mb-2">Try these instead:</div>
          <div className="flex flex-wrap gap-2">
            {availability.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setUsername(suggestion)}
                className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-gray-300 hover:border-[#C3FF00] hover:text-white transition"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Claim button */}
      <button
        onClick={handleClaim}
        disabled={!availability?.available || isClaiming}
        className={`w-full mt-6 px-6 py-3 rounded-xl font-semibold transition ${
          availability?.available
            ? "bg-[#C3FF00] text-black hover:bg-[#d4ff4d]"
            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
        }`}
      >
        {isClaiming ? "Claiming..." : "Claim Username"}
      </button>
    </div>
  );
}
