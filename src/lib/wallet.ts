// Wallet utilities for Base inscription
// Supports both CDP Smart Wallet (gasless) and user wallet fallback

import { createPublicClient, createWalletClient, http, custom, encodeFunctionData, type Chain } from 'viem';
import { base, baseSepolia, mainnet } from 'viem/chains';

// Chain options
export type ChainOption = 'eth' | 'base';

const CHAINS: Record<ChainOption, Chain> = {
  eth: mainnet,
  base: process.env.NEXT_PUBLIC_USE_TESTNET === 'true' ? baseSepolia : base,
};

// Default chain
const DEFAULT_CHAIN: ChainOption = 'base';

// Current selected chain (can be changed by user)
let selectedChain: ChainOption = DEFAULT_CHAIN;

// Check if CDP is configured
export function isCDPConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_CDP_API_KEY &&
    process.env.NEXT_PUBLIC_CDP_API_KEY !== 'xxx'
  );
}

// Set the active chain
export function setChain(chain: ChainOption) {
  selectedChain = chain;
}

// Get current chain
export function getSelectedChain(): ChainOption {
  return selectedChain;
}

// Create public client for reading
export function getPublicClient() {
  return createPublicClient({
    chain: CHAINS[selectedChain],
    transport: http(),
  });
}

// Create wallet client from browser wallet (MetaMask, Coinbase Wallet, etc.)
export async function getUserWalletClient() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet found. Please install MetaMask or Coinbase Wallet.');
  }

  const CHAIN = CHAINS[selectedChain];

  // Request account access
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found. Please connect your wallet.');
  }

  // Check if on correct chain
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  const expectedChainId = CHAIN.id;

  if (parseInt(chainId as string, 16) !== expectedChainId) {
    // Try to switch chain
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
      });
    } catch (switchError: unknown) {
      // Chain not added, try to add it (only for non-mainnet)
      if ((switchError as { code?: number })?.code === 4902 && selectedChain !== 'eth') {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${expectedChainId.toString(16)}`,
            chainName: CHAIN.name,
            nativeCurrency: CHAIN.nativeCurrency,
            rpcUrls: [CHAIN.rpcUrls.default.http[0]],
            blockExplorerUrls: [CHAIN.blockExplorers?.default.url],
          }],
        });
      } else {
        throw switchError;
      }
    }
  }

  return createWalletClient({
    chain: CHAIN,
    transport: custom(window.ethereum),
    account: (accounts as string[])[0] as `0x${string}`,
  });
}

// Convert HTML to inscription calldata
export function htmlToCalldata(html: string): `0x${string}` {
  // Create data URI with base64 encoded HTML
  const base64 = btoa(unescape(encodeURIComponent(html)));
  const dataUri = `data:text/html;base64,${base64}`;

  // Convert to hex
  const hex = Array.from(new TextEncoder().encode(dataUri))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `0x${hex}` as `0x${string}`;
}

// Inscribe HTML using user's wallet (fallback mode)
export async function inscribeWithUserWallet(html: string): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
  explorerUrl?: string;
  chain?: ChainOption;
}> {
  try {
    const CHAIN = CHAINS[selectedChain];
    const walletClient = await getUserWalletClient();
    const calldata = htmlToCalldata(html);

    // Send transaction to self with calldata
    const txHash = await walletClient.sendTransaction({
      to: walletClient.account.address,
      data: calldata,
      value: 0n,
    });

    const explorerUrl = `${CHAIN.blockExplorers?.default.url}/tx/${txHash}`;

    return {
      success: true,
      txHash,
      explorerUrl,
      chain: selectedChain,
    };
  } catch (error) {
    console.error('Inscription failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Estimate gas cost for inscription
export async function estimateInscriptionCost(html: string): Promise<{
  gasUnits: bigint;
  gasPriceGwei: number;
  estimatedCostEth: string;
  estimatedCostUsd: string;
}> {
  const publicClient = getPublicClient();
  const calldata = htmlToCalldata(html);

  // Base transaction cost + calldata cost
  const calldataBytes = (calldata.length - 2) / 2; // Remove 0x, divide by 2 for bytes
  const gasUnits = BigInt(21000 + calldataBytes * 16);

  // Get current gas price
  const gasPrice = await publicClient.getGasPrice();
  const gasPriceGwei = Number(gasPrice) / 1e9;

  // Calculate cost
  const costWei = gasUnits * gasPrice;
  const costEth = Number(costWei) / 1e18;

  // Base ETH price (rough estimate)
  const ethPrice = 3500;
  const costUsd = costEth * ethPrice;

  return {
    gasUnits,
    gasPriceGwei: Math.round(gasPriceGwei * 100) / 100,
    estimatedCostEth: costEth.toFixed(6),
    estimatedCostUsd: costUsd.toFixed(4),
  };
}

// Get chain info
export function getChainInfo() {
  const CHAIN = CHAINS[selectedChain];
  return {
    name: CHAIN.name,
    id: CHAIN.id,
    explorer: CHAIN.blockExplorers?.default.url,
    isTestnet: CHAIN.id === baseSepolia.id,
    chainKey: selectedChain,
  };
}

// ============================================
// TIC Protocol - Transaction Inscribed Comments
// https://github.com/Ethereum-Phunks/tic-protocol
// ============================================

export interface TICComment {
  topic: string;      // tx hash of the content being commented on
  content: string;    // the comment text
  version: string;    // protocol version (0x0)
  encoding?: string;  // utf8, base64, markdown, etc.
  type?: string;      // 'comment' or 'reaction'
}

// Create TIC comment calldata
export function createTICCalldata(comment: TICComment): `0x${string}` {
  const tic = {
    topic: comment.topic,
    content: comment.content,
    version: '0x0',
    encoding: comment.encoding || 'utf8',
    type: comment.type || 'comment',
  };

  // TIC format: data:message/vnd.tic+json;rule=esip6,{json}
  const json = JSON.stringify(tic);
  const dataUri = `data:message/vnd.tic+json;rule=esip6,${json}`;

  // Convert to hex
  const hex = Array.from(new TextEncoder().encode(dataUri))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `0x${hex}` as `0x${string}`;
}

// Post a TIC comment using user's wallet
export async function postTICComment(
  topic: string,    // tx hash of the blog post
  content: string,  // comment text
  parentTopic?: string  // for replies, the parent comment's tx hash
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
  explorerUrl?: string;
}> {
  try {
    const walletClient = await getUserWalletClient();

    const comment: TICComment = {
      topic: parentTopic ? `${topic}:${parentTopic}` : topic,
      content,
      version: '0x0',
      encoding: 'utf8',
      type: 'comment',
    };

    const calldata = createTICCalldata(comment);

    // Send transaction to self with calldata
    const txHash = await walletClient.sendTransaction({
      to: walletClient.account.address,
      data: calldata,
      value: 0n,
    });

    const explorerUrl = `${CHAIN.blockExplorers?.default.url}/tx/${txHash}`;

    return {
      success: true,
      txHash,
      explorerUrl,
    };
  } catch (error) {
    console.error('TIC comment failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Fetch TIC comments for a topic from an indexer
// Note: This requires a TIC indexer API - for now we'll use a placeholder
export async function fetchTICComments(topic: string): Promise<{
  comments: Array<{
    txHash: string;
    author: string;
    content: string;
    timestamp: number;
    replies?: Array<{
      txHash: string;
      author: string;
      content: string;
      timestamp: number;
    }>;
  }>;
  error?: string;
}> {
  // TODO: Integrate with TIC indexer when available
  // For now, return empty array - comments will be fetched client-side
  // or from a custom indexer you set up

  // Placeholder: could use ethscriptions indexer or build custom
  // const res = await fetch(`https://api.tic.xyz/comments?topic=${topic}`);

  return { comments: [] };
}

// Extend window type for ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
