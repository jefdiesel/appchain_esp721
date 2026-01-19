const crypto = require('crypto');
const { ethers } = require('ethers');

// All available Unicode symbols from our scans
const AVAILABLE = [
  // Math symbols
  '∇', '∈', '∉', '∋', '∌', '∩', '⊂', '⊃', '⊆', '⊇', '⊕', '⊗', '⊥',
  '∠', '∡', '∢', '∥', '∦', '≡', '≪', '≫', '∬', '∭', '∮', '∯', '∰',
  '∝', '∀', '∃', '∄', '∅', '⊻', '⊼', '⊽', '⊾', '⊿',
  // Arrows
  '↑', '↓', '←', '→', '↔', '↕', '↖', '↗', '↘', '↙', '↚', '↛',
  '↜', '↝', '↞', '↟', '↠', '↡', '↢', '↣', '↤', '↥', '↦', '↧',
  '↨', '↩', '↪', '↫', '↬', '↭', '↮', '↯', '↰', '↱', '↲', '↳',
  '↴', '↵', '↶', '↷', '↸', '↹', '↺', '↻',
  '⇄', '⇅', '⇆', '⇇', '⇈', '⇉', '⇊', '⇋', '⇌', '⇍', '⇎', '⇏',
  '⇐', '⇑', '⇒', '⇓', '⇔', '⇕', '⇖', '⇗', '⇘', '⇙', '⇚', '⇛', '⇜', '⇝', '⇞', '⇟',
  // Geometric shapes
  '△', '▲', '▴', '▵', '▷', '▸', '▹', '►', '▻', '▼', '▽', '▾', '▿',
  '◀', '◁', '◂', '◃', '◄', '◅', '◆', '◈', '▪', '▫', '▬', '▭', '▮', '▯', '▰', '▱', '▢',
  '◘', '◙', '◚', '◛', '◜', '◝', '◞', '◟', '◠', '◡', '◢', '◣', '◤', '◥',
  '◦', '◧', '◨', '◩', '◪', '◫', '◭', '◮', '◯', '◴', '◵', '◶', '◷', '◸', '◹', '◺', '◻', '◿',
  // Stars
  '✦', '✧', '✩', '✫', '✬', '✭', '✮',
  // Misc symbols
  '☇', '☈', '☉', '☊', '☋', '☌', '☍', '☎', '☏', '☐', '☖', '☗',
  '☚', '☛', '☜', '☝', '☞', '☟', '☡', '☧', '☨', '☩', '☫', '☬',
  '☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷', '☼', '☽', '☾', '☿',
  '♁', '♃', '♄', '♅', '♆', '♇',
  // Chess
  '♜', '♝', '♞', '♟',
  // Music
  '♩', '♬', '♭', '♮', '♯',
  // Currency
  '₦', '₱', '₲', '₴', '₵', '₹', '₺',
  // Chinese (from curated scan)
  '祥', '熊', '龟', '狼', '橙', '侠', '将', '狐', '君', '鹤', '湖',
  '梦', '码', '永', '北', '块', '忆', '愿', '霸', '念', '恒', '南', '孝', '忠', '绝', '飒',
  // Emoji
  '🟰',
];

const API = 'https://api.ethscriptions.com/v2/ethscriptions/exists/0x';
const RPC = process.env.ETH_RPC || 'https://eth.llamarpc.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('Error: Set PRIVATE_KEY environment variable');
  console.error('Usage: PRIVATE_KEY=0x... node scripts/register-unicode.js');
  process.exit(1);
}

async function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function isAvailable(name) {
  const hash = await sha256(`data:,${name}`);
  try {
    const res = await fetch(`${API}${hash}`);
    const data = await res.json();
    return !data.result?.exists;
  } catch (e) {
    return null; // Unknown
  }
}

async function inscribe(wallet, name) {
  const content = `data:,${name}`;
  const data = ethers.hexlify(ethers.toUtf8Bytes(content));

  const tx = await wallet.sendTransaction({
    to: wallet.address,
    data: data,
    value: 0,
  });

  return tx;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log('Wallet:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // First verify which are still available
  console.log('Checking availability...');
  const stillAvailable = [];

  for (const symbol of AVAILABLE) {
    const available = await isAvailable(symbol);
    if (available === true) {
      stillAvailable.push(symbol);
      process.stdout.write(`✓ ${symbol} `);
    } else if (available === false) {
      process.stdout.write(`✗ ${symbol} `);
    } else {
      process.stdout.write(`? ${symbol} `);
    }
  }

  console.log(`\n\n${stillAvailable.length} symbols still available\n`);

  if (stillAvailable.length === 0) {
    console.log('Nothing to register!');
    return;
  }

  // Estimate gas cost
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  const estimatedGasPerTx = 21500n; // Base tx + small data
  const totalGas = estimatedGasPerTx * BigInt(stillAvailable.length);
  const totalCost = totalGas * gasPrice;

  console.log('Estimated cost:', ethers.formatEther(totalCost), 'ETH');
  console.log('Gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
  console.log('');

  if (balance < totalCost) {
    console.error('Insufficient balance!');
    return;
  }

  // Register each one
  console.log('Registering...\n');

  let success = 0;
  let failed = 0;

  for (const symbol of stillAvailable) {
    try {
      process.stdout.write(`${symbol} ... `);
      const tx = await inscribe(wallet, symbol);
      console.log(tx.hash);
      success++;

      // Small delay to avoid nonce issues
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.log('FAILED:', e.message);
      failed++;
    }
  }

  console.log(`\nDone! ${success} registered, ${failed} failed`);
}

main().catch(console.error);
