/**
 * Claim Ethscription Names
 *
 * Usage: node claim-names.js [--limit N] [--start N] [--dry-run]
 *
 * Reads available-4letter-words.txt and inscribes each as "data:,word"
 */

const fs = require('fs');
const { ethers } = require('ethers');
const readline = require('readline');

// Config - use good-4letter-words.txt for curated list
const WORDS_FILE = './good-4letter-words.txt';
const RPC_URL = 'https://eth.llamarpc.com'; // or use your own RPC
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Set this!

// Parse args
const args = process.argv.slice(2);
const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : 10;
const start = args.includes('--start') ? parseInt(args[args.indexOf('--start') + 1]) : 0;
const dryRun = args.includes('--dry-run');

async function main() {
  if (!PRIVATE_KEY && !dryRun) {
    console.error('ERROR: Set PRIVATE_KEY environment variable');
    console.error('  export PRIVATE_KEY=0x...');
    process.exit(1);
  }

  // Read words
  const words = fs.readFileSync(WORDS_FILE, 'utf8')
    .split('\n')
    .filter(w => w.trim())
    .slice(start, start + limit);

  console.log(`\n=== CLAIM ${words.length} NAMES ===\n`);
  console.log('Words to claim:', words.join(', '));
  console.log('');

  if (dryRun) {
    console.log('[DRY RUN] Would inscribe:');
    words.forEach(w => console.log(`  data:,${w}`));
    return;
  }

  // Setup provider & wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const address = wallet.address;

  console.log(`Wallet: ${address}`);
  const balance = await provider.getBalance(address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Estimate gas for one tx
  const gasPrice = await provider.getFeeData();
  const estimatedGasPerTx = 21000n + 16n * 10n; // base + ~10 bytes calldata
  const costPerTx = estimatedGasPerTx * gasPrice.gasPrice;
  const totalCost = costPerTx * BigInt(words.length);

  console.log(`Estimated cost per tx: ${ethers.formatEther(costPerTx)} ETH`);
  console.log(`Estimated total cost: ${ethers.formatEther(totalCost)} ETH\n`);

  // Confirm
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve => {
    rl.question('Proceed? (yes/no): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'yes') {
    console.log('Aborted.');
    return;
  }

  // Claim each word
  let nonce = await provider.getTransactionCount(address);
  const results = { success: [], failed: [] };

  for (const word of words) {
    const dataUri = `data:,${word}`;
    const hexData = '0x' + Buffer.from(dataUri).toString('hex');

    try {
      console.log(`Claiming "${word}"...`);

      const tx = await wallet.sendTransaction({
        to: address, // self-transfer
        data: hexData,
        value: 0,
        nonce: nonce++,
      });

      console.log(`  TX: ${tx.hash}`);
      results.success.push({ word, tx: tx.hash });

      // Wait a bit between txs to avoid rate limits
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      results.failed.push({ word, error: err.message });
    }
  }

  // Summary
  console.log('\n=== RESULTS ===');
  console.log(`Success: ${results.success.length}`);
  console.log(`Failed: ${results.failed.length}`);

  if (results.success.length > 0) {
    console.log('\nClaimed:');
    results.success.forEach(r => console.log(`  ${r.word}: ${r.tx}`));
  }

  if (results.failed.length > 0) {
    console.log('\nFailed:');
    results.failed.forEach(r => console.log(`  ${r.word}: ${r.error}`));
  }
}

main().catch(console.error);
