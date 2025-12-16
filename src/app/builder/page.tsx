"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";

type Step = "template" | "customize" | "domain" | "review";

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
}

const templates: Template[] = [
  {
    id: "minimal",
    name: "Minimal Portfolio",
    description: "Clean single-page portfolio",
    category: "portfolio",
  },
  {
    id: "links",
    name: "Link Tree",
    description: "Link-in-bio style page",
    category: "links",
  },
  {
    id: "blog",
    name: "Blog Post",
    description: "Simple article page",
    category: "blog",
  },
  {
    id: "custom",
    name: "Custom HTML",
    description: "Paste your own HTML",
    category: "custom",
  },
];

export default function BuilderPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [step, setStep] = useState<Step>("template");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("");
  const [tagline, setTagline] = useState("");
  const [customHtml, setCustomHtml] = useState("");
  const [domainSearch, setDomainSearch] = useState("");
  const [domainResults, setDomainResults] = useState<
    Array<{
      domain: string;
      tld: string;
      fullDomain: string;
      available: boolean;
      price?: number;
    }>
  >([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    redirect("/sign-in");
  }

  const searchDomains = async () => {
    if (!domainSearch.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/domains/search?domain=${encodeURIComponent(domainSearch)}`
      );
      const data = await res.json();
      setDomainResults(data.results || []);
    } catch (error) {
      console.error("Domain search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const registerDomain = async () => {
    if (!selectedDomain) return;

    const selected = domainResults.find(
      (d) => d.fullDomain === selectedDomain
    );
    if (!selected) return;

    setIsRegistering(true);
    try {
      const res = await fetch("/api/domains/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: selected.domain, tld: selected.tld }),
      });

      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error("Domain registration failed:", error);
    } finally {
      setIsRegistering(false);
    }
  };

  const estimateGas = () => {
    const html =
      selectedTemplate === "custom"
        ? customHtml
        : `<html><body>${siteName} ${tagline}</body></html>`;
    const bytes = new Blob([html]).size;
    const gasUnits = 21000 + bytes * 16;
    const ethCost = (gasUnits * 20) / 1e9;
    const usdCost = ethCost * 3500;
    return {
      bytes,
      gasUnits,
      estimatedCostUsd: usdCost.toFixed(2),
    };
  };

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            <span className="text-white">CHAIN</span>
            <span className="text-[#C3FF00]">HOST</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/dashboard"
              className="hover:text-[#C3FF00] transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {(["template", "customize", "domain", "review"] as Step[]).map(
            (s, i) => (
              <div key={s} className="flex items-center gap-4">
                <button
                  onClick={() => setStep(s)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
                    step === s
                      ? "bg-[#C3FF00] text-black"
                      : "bg-zinc-800 text-gray-500"
                  }`}
                >
                  {i + 1}
                </button>
                {i < 3 && <div className="w-12 h-px bg-zinc-800" />}
              </div>
            )
          )}
        </div>

        {/* Step Content */}
        {step === "template" && (
          <div>
            <h1 className="text-3xl font-bold text-white text-center mb-2">
              Choose a template
            </h1>
            <p className="text-gray-500 text-center mb-8">
              Start with a template or paste your own HTML
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template.id);
                    setStep("customize");
                  }}
                  className={`p-6 border rounded-xl text-left transition ${
                    selectedTemplate === template.id
                      ? "border-[#C3FF00] bg-zinc-900"
                      : "border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <h3 className="text-white font-semibold mb-1">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-500">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "customize" && (
          <div>
            <h1 className="text-3xl font-bold text-white text-center mb-2">
              Customize your site
            </h1>
            <p className="text-gray-500 text-center mb-8">
              {selectedTemplate === "custom"
                ? "Paste your HTML below"
                : "Fill in the details for your site"}
            </p>

            {selectedTemplate === "custom" ? (
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  HTML Content
                </label>
                <textarea
                  value={customHtml}
                  onChange={(e) => setCustomHtml(e.target.value)}
                  className="w-full h-96 bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-sm text-gray-300 focus:border-[#C3FF00] focus:outline-none"
                  placeholder="<!DOCTYPE html>
<html>
<head>
  <title>My Site</title>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>"
                />
                <div className="text-sm text-gray-500 mt-2">
                  {customHtml.length} characters |{" "}
                  {new Blob([customHtml]).size} bytes
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Site Name
                  </label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#C3FF00] focus:outline-none"
                    placeholder="My Awesome Site"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#C3FF00] focus:outline-none"
                    placeholder="Building cool things on the blockchain"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep("template")}
                className="px-6 py-3 border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
              >
                Back
              </button>
              <button
                onClick={() => setStep("domain")}
                className="flex-1 px-6 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === "domain" && (
          <div>
            <h1 className="text-3xl font-bold text-white text-center mb-2">
              Register a domain
            </h1>
            <p className="text-gray-500 text-center mb-8">
              Search for an available domain or skip for now
            </p>

            <div className="flex gap-4 mb-6">
              <input
                type="text"
                value={domainSearch}
                onChange={(e) => setDomainSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchDomains()}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-[#C3FF00] focus:outline-none"
                placeholder="Search for a domain..."
              />
              <button
                onClick={searchDomains}
                disabled={isSearching}
                className="px-6 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition disabled:opacity-50"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>

            {domainResults.length > 0 && (
              <div className="space-y-2 mb-6">
                {domainResults.map((result) => (
                  <button
                    key={result.fullDomain}
                    onClick={() =>
                      result.available && setSelectedDomain(result.fullDomain)
                    }
                    disabled={!result.available}
                    className={`w-full p-4 border rounded-xl flex items-center justify-between transition ${
                      selectedDomain === result.fullDomain
                        ? "border-[#C3FF00] bg-zinc-900"
                        : result.available
                        ? "border-zinc-800 hover:border-zinc-700"
                        : "border-zinc-800 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <span className="text-white font-mono">
                      {result.fullDomain}
                    </span>
                    {result.available ? (
                      <span className="text-[#C3FF00]">
                        ${result.price}/year
                      </span>
                    ) : (
                      <span className="text-red-500">Taken</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {selectedDomain && (
              <button
                onClick={registerDomain}
                disabled={isRegistering}
                className="w-full px-6 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition disabled:opacity-50 mb-4"
              >
                {isRegistering
                  ? "Redirecting to checkout..."
                  : `Register ${selectedDomain}`}
              </button>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep("customize")}
                className="px-6 py-3 border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
              >
                Back
              </button>
              <button
                onClick={() => setStep("review")}
                className="flex-1 px-6 py-3 border border-zinc-700 rounded-lg hover:border-[#C3FF00] transition"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div>
            <h1 className="text-3xl font-bold text-white text-center mb-2">
              Review and inscribe
            </h1>
            <p className="text-gray-500 text-center mb-8">
              Ready to make your site permanent
            </p>

            <div className="border border-zinc-800 rounded-xl p-6 mb-6">
              <h3 className="text-white font-semibold mb-4">Site Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Template</span>
                  <span className="text-white">{selectedTemplate}</span>
                </div>
                {selectedTemplate !== "custom" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Name</span>
                      <span className="text-white">{siteName || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tagline</span>
                      <span className="text-white">{tagline || "-"}</span>
                    </div>
                  </>
                )}
                {selectedDomain && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Domain</span>
                    <span className="text-white">{selectedDomain}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border border-zinc-800 rounded-xl p-6 mb-6">
              <h3 className="text-white font-semibold mb-4">
                Inscription Estimate
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Size</span>
                  <span className="text-white">{estimateGas().bytes} bytes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Est. Gas</span>
                  <span className="text-white">
                    {estimateGas().gasUnits.toLocaleString()} units
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Est. Cost</span>
                  <span className="text-[#C3FF00]">
                    ~${estimateGas().estimatedCostUsd}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
              <h3 className="text-white font-semibold mb-2">How to inscribe</h3>
              <p className="text-sm text-gray-500 mb-4">
                Copy the calldata below and send it as a transaction to yourself
                using your wallet. After confirmation, paste the tx hash to link
                it to your site.
              </p>
              <button
                onClick={() => {
                  // TODO: Generate and copy calldata
                  alert("Calldata generation coming soon!");
                }}
                className="w-full px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition"
              >
                Generate Calldata
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep("domain")}
                className="px-6 py-3 border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
              >
                Back
              </button>
              <button
                onClick={() => {
                  // TODO: Save site to database
                  alert("Site saving coming soon!");
                }}
                className="flex-1 px-6 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
              >
                Save Site
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
