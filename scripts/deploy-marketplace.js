/**
 * Deploy EthscriptionMarketplace Contract
 *
 * Usage:
 *   node scripts/deploy-marketplace.js [--chain eth|base] [--dry-run]
 *
 * Environment:
 *   PRIVATE_KEY - Deployer private key
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract bytecode and ABI (compiled with solc)
// For now, we'll use a placeholder - you need to compile the contract first
const CONTRACT_SOURCE = fs.readFileSync(
  path.join(__dirname, '../contracts/EthscriptionMarketplace.sol'),
  'utf8'
);

// Chain configs
const CHAINS = {
  eth: {
    name: 'Ethereum Mainnet',
    rpc: 'https://eth.llamarpc.com',
    chainId: 1,
    explorer: 'https://etherscan.io',
  },
  base: {
    name: 'Base',
    rpc: 'https://mainnet.base.org',
    chainId: 8453,
    explorer: 'https://basescan.org',
  },
};

// Parse args
const args = process.argv.slice(2);
const chainArg = args.includes('--chain') ? args[args.indexOf('--chain') + 1] : 'base';
const dryRun = args.includes('--dry-run');

async function main() {
  const chain = CHAINS[chainArg];
  if (!chain) {
    console.error('Invalid chain. Use: eth or base');
    process.exit(1);
  }

  console.log(`\n=== Deploy EthscriptionMarketplace ===`);
  console.log(`Chain: ${chain.name}`);
  console.log(`RPC: ${chain.rpc}`);
  console.log(`Dry run: ${dryRun}\n`);

  if (!process.env.PRIVATE_KEY && !dryRun) {
    console.error('ERROR: Set PRIVATE_KEY environment variable');
    console.error('  export PRIVATE_KEY=0x...');
    process.exit(1);
  }

  // Connect to provider
  const provider = new ethers.JsonRpcProvider(chain.rpc);

  if (dryRun) {
    console.log('[DRY RUN] Would deploy contract to', chain.name);
    console.log('\nContract source loaded:', CONTRACT_SOURCE.length, 'bytes');
    console.log('\nTo deploy for real:');
    console.log('  1. Install solc: npm install -g solc');
    console.log('  2. Compile: solcjs --bin --abi contracts/EthscriptionMarketplace.sol');
    console.log('  3. Run: PRIVATE_KEY=0x... node scripts/deploy-marketplace.js --chain', chainArg);
    return;
  }

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Deployer: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Check if we have compiled bytecode
  const bytecodeFile = path.join(__dirname, '../contracts/EthscriptionMarketplace.bin');
  const abiFile = path.join(__dirname, '../contracts/EthscriptionMarketplace.abi');

  if (!fs.existsSync(bytecodeFile) || !fs.existsSync(abiFile)) {
    console.error('Contract not compiled. Run:');
    console.error('  cd contracts && solcjs --bin --abi --optimize EthscriptionMarketplace.sol');
    console.error('  mv EthscriptionMarketplace.bin EthscriptionMarketplace.abi ../');
    process.exit(1);
  }

  const bytecode = '0x' + fs.readFileSync(bytecodeFile, 'utf8').trim();
  const abi = JSON.parse(fs.readFileSync(abiFile, 'utf8'));

  console.log('Deploying contract...');

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();

  console.log(`TX: ${contract.deploymentTransaction().hash}`);
  console.log('Waiting for confirmation...');

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\n=== DEPLOYED ===`);
  console.log(`Address: ${address}`);
  console.log(`Explorer: ${chain.explorer}/address/${address}`);
  console.log(`\nUpdate src/lib/marketplace.ts with:`);
  console.log(`  ${chainArg}: '${address}'`);
}

main().catch(console.error);
