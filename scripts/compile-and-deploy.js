/**
 * Compile and Deploy EthscriptionMarketplace
 */

const solc = require('solc');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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
const PRIVATE_KEY = process.env.PRIVATE_KEY;

async function compile() {
  console.log('Compiling contract...');

  const source = fs.readFileSync(
    path.join(__dirname, '../contracts/EthscriptionMarketplace.sol'),
    'utf8'
  );

  const input = {
    language: 'Solidity',
    sources: {
      'EthscriptionMarketplace.sol': { content: source },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode'] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      console.error('Compilation errors:');
      errors.forEach(e => console.error(e.formattedMessage));
      process.exit(1);
    }
    // Show warnings
    output.errors.filter(e => e.severity === 'warning').forEach(e => {
      console.warn('Warning:', e.message);
    });
  }

  const contract = output.contracts['EthscriptionMarketplace.sol']['EthscriptionMarketplace'];
  console.log('Compiled successfully!\n');

  return {
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
  };
}

async function deploy(abi, bytecode) {
  const chain = CHAINS[chainArg];
  if (!chain) {
    console.error('Invalid chain. Use: eth or base');
    process.exit(1);
  }

  console.log(`Deploying to ${chain.name}...`);
  console.log(`RPC: ${chain.rpc}\n`);

  if (!PRIVATE_KEY) {
    console.error('ERROR: Set PRIVATE_KEY environment variable');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(chain.rpc);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`Deployer: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    console.error('ERROR: No balance to deploy');
    process.exit(1);
  }

  // Estimate deployment cost
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployTx = await factory.getDeployTransaction();
  const gasEstimate = await provider.estimateGas(deployTx);
  const feeData = await provider.getFeeData();
  const estimatedCost = gasEstimate * feeData.gasPrice;

  console.log(`Estimated gas: ${gasEstimate.toString()}`);
  console.log(`Estimated cost: ${ethers.formatEther(estimatedCost)} ETH\n`);

  // Confirm
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve => {
    rl.question('Deploy? (yes/no): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'yes') {
    console.log('Aborted.');
    return;
  }

  console.log('\nDeploying...');
  const contract = await factory.deploy();
  console.log(`TX: ${contract.deploymentTransaction().hash}`);
  console.log('Waiting for confirmation...');

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`CONTRACT DEPLOYED!`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Address: ${address}`);
  console.log(`Explorer: ${chain.explorer}/address/${address}`);
  console.log(`\nUpdate src/lib/marketplace.ts:`);
  console.log(`  ${chainArg}: '${address}'`);

  // Save deployment info
  const deployInfo = {
    chain: chainArg,
    address,
    deployer: wallet.address,
    txHash: contract.deploymentTransaction().hash,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(__dirname, `../contracts/deployment-${chainArg}.json`),
    JSON.stringify(deployInfo, null, 2)
  );
  console.log(`\nDeployment info saved to contracts/deployment-${chainArg}.json`);
}

async function main() {
  const { abi, bytecode } = await compile();
  await deploy(abi, bytecode);
}

main().catch(console.error);
