#!/usr/bin/env node
/**
 * Wrapper Relayer
 *
 * Watches for:
 *   - Deposited events on AppChain EthscriptionVault → mints ERC-721 on Ethereum mainnet
 *   - Burned events on Ethereum mainnet WrappedEthscription → withdraws on AppChain
 *
 * Idempotent: uses SQLite to track processed events.
 *
 * Env vars:
 *   APPCHAIN_RPC          - AppChain RPC URL (default: https://mainnet.ethscriptions.com)
 *   MAINNET_RPC           - Ethereum mainnet RPC URL
 *   VAULT_ADDRESS         - EthscriptionVault contract on AppChain
 *   WRAPPED_ADDRESS       - WrappedEthscription contract on Ethereum mainnet
 *   RELAYER_PRIVATE_KEY   - Private key for relayer wallet (funded on both chains)
 *   POLL_INTERVAL_MS      - Polling interval (default: 10000)
 *   SQLITE_PATH           - Path to SQLite DB (default: ./relayer.db)
 */

const { ethers } = require("ethers");
const { Database } = require("better-sqlite3");
const path = require("path");

// --- Config ---
const APPCHAIN_RPC = process.env.APPCHAIN_RPC || "https://mainnet.ethscriptions.com";
const MAINNET_RPC = process.env.MAINNET_RPC || "https://eth.llamarpc.com";
const VAULT_ADDRESS = process.env.VAULT_ADDRESS;
const WRAPPED_ADDRESS = process.env.WRAPPED_ADDRESS;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "10000", 10);
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, "relayer.db");

if (!VAULT_ADDRESS || !WRAPPED_ADDRESS || !RELAYER_PRIVATE_KEY) {
  console.error("Missing required env vars: VAULT_ADDRESS, WRAPPED_ADDRESS, RELAYER_PRIVATE_KEY");
  process.exit(1);
}

// --- ABIs (minimal) ---
const VAULT_ABI = [
  "event Deposited(bytes32 indexed ethscriptionId, address indexed owner)",
  "event Withdrawn(bytes32 indexed ethscriptionId, address indexed to)",
  "function withdraw(bytes32 ethscriptionId, address to) external",
];

const WRAPPED_ABI = [
  "event Burned(bytes32 indexed ethscriptionId, address indexed owner)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function mint(bytes32 ethscriptionId, address to) external",
];

// --- Providers & Wallets ---
const appchainProvider = new ethers.JsonRpcProvider(APPCHAIN_RPC);
const mainnetProvider = new ethers.JsonRpcProvider(MAINNET_RPC);

const appchainWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, appchainProvider);
const mainnetWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, mainnetProvider);

const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, appchainWallet);
const wrapped = new ethers.Contract(WRAPPED_ADDRESS, WRAPPED_ABI, mainnetWallet);

// --- SQLite ---
const db = new Database(SQLITE_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS processed_events (
    chain TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    ethscription_id TEXT NOT NULL,
    target_tx_hash TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (chain, tx_hash, log_index)
  );
  CREATE TABLE IF NOT EXISTS cursors (
    chain TEXT PRIMARY KEY,
    block_number INTEGER NOT NULL
  );
`);

const stmtGetCursor = db.prepare("SELECT block_number FROM cursors WHERE chain = ?");
const stmtSetCursor = db.prepare("INSERT OR REPLACE INTO cursors (chain, block_number) VALUES (?, ?)");
const stmtCheckProcessed = db.prepare("SELECT 1 FROM processed_events WHERE chain = ? AND tx_hash = ? AND log_index = ?");
const stmtInsertProcessed = db.prepare(
  "INSERT INTO processed_events (chain, tx_hash, log_index, event_type, ethscription_id, target_tx_hash) VALUES (?, ?, ?, ?, ?, ?)"
);

function getCursor(chain) {
  const row = stmtGetCursor.get(chain);
  return row ? row.block_number : 0;
}

function isProcessed(chain, txHash, logIndex) {
  return !!stmtCheckProcessed.get(chain, txHash, logIndex);
}

// --- Main Loop ---
async function pollDeposits() {
  const fromBlock = getCursor("appchain") + 1;
  const toBlock = await appchainProvider.getBlockNumber();
  if (fromBlock > toBlock) return;

  const filter = vault.filters.Deposited();
  const events = await vault.queryFilter(filter, fromBlock, toBlock);

  for (const event of events) {
    const txHash = event.transactionHash;
    const logIndex = event.index;
    if (isProcessed("appchain", txHash, logIndex)) continue;

    const ethscriptionId = event.args[0];
    const owner = event.args[1];

    console.log(`[DEPOSIT] ${ethscriptionId} from ${owner} — minting on mainnet...`);

    try {
      const tx = await wrapped.mint(ethscriptionId, owner);
      const receipt = await tx.wait();
      console.log(`[MINT] tx: ${receipt.hash}`);

      stmtInsertProcessed.run("appchain", txHash, logIndex, "deposit", ethscriptionId, receipt.hash);
    } catch (err) {
      console.error(`[MINT ERROR] ${ethscriptionId}:`, err.message);
      continue; // Will retry next poll
    }
  }

  stmtSetCursor.run("appchain", toBlock);
}

async function pollBurns() {
  const fromBlock = getCursor("mainnet") + 1;
  const toBlock = await mainnetProvider.getBlockNumber();
  if (fromBlock > toBlock) return;

  const filter = wrapped.filters.Burned();
  const events = await wrapped.queryFilter(filter, fromBlock, toBlock);

  for (const event of events) {
    const txHash = event.transactionHash;
    const logIndex = event.index;
    if (isProcessed("mainnet", txHash, logIndex)) continue;

    const ethscriptionId = event.args[0];
    const owner = event.args[1];

    console.log(`[BURN] ${ethscriptionId} by ${owner} — withdrawing on AppChain...`);

    try {
      const tx = await vault.withdraw(ethscriptionId, owner);
      const receipt = await tx.wait();
      console.log(`[WITHDRAW] tx: ${receipt.hash}`);

      stmtInsertProcessed.run("mainnet", txHash, logIndex, "burn", ethscriptionId, receipt.hash);
    } catch (err) {
      console.error(`[WITHDRAW ERROR] ${ethscriptionId}:`, err.message);
      continue;
    }
  }

  stmtSetCursor.run("mainnet", toBlock);
}

async function run() {
  console.log("Wrapper Relayer started");
  console.log(`Vault: ${VAULT_ADDRESS}`);
  console.log(`Wrapped: ${WRAPPED_ADDRESS}`);
  console.log(`Relayer: ${appchainWallet.address}`);
  console.log(`Poll interval: ${POLL_INTERVAL}ms`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await pollDeposits();
      await pollBurns();
    } catch (err) {
      console.error("[POLL ERROR]", err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

run();
