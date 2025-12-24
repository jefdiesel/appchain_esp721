const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { mainnet } = require('viem/chains');

const OLD_CONTRACT = '0x3e67d49716e50a8b1c71b8dEa0e31755305733fd';

const ABI = [
  {
    name: 'deposit',
    type: 'function',
    inputs: [{ name: 'ethscriptionId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'cancelAndWithdraw',
    type: 'function',
    inputs: [{ name: 'ethscriptionId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'depositors',
    type: 'function',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
];

const STUCK_ETHSCRIPTIONS = [
  '0x2127aed3f33b1de51f6079fdc1f8c62470477d822f172a94491810107b4efd7d',
  '0xaba1669cb122c31efb8c61114587f4c6d0ed6322cfd35f540a4e9d349038ac9c',
  '0x04fd56026adca924ebe34d20956e990946e501edeeddb959d001b6e299d0fa45',
];

async function main() {
  const privateKey = process.argv[2];
  if (!privateKey) {
    console.error('Usage: node rescue-old-contract.js <private-key>');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);
  console.log('Rescuing from:', account.address);
  console.log('Old contract:', OLD_CONTRACT);
  console.log('');

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http('https://ethereum-rpc.publicnode.com'),
  });

  const walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http('https://ethereum-rpc.publicnode.com'),
  });

  for (const ethscriptionId of STUCK_ETHSCRIPTIONS) {
    console.log(`\n=== Processing ${ethscriptionId.slice(0, 10)}... ===`);

    // Check current depositor
    const depositor = await publicClient.readContract({
      address: OLD_CONTRACT,
      abi: ABI,
      functionName: 'depositors',
      args: [ethscriptionId],
    });

    console.log('Current depositor:', depositor);

    if (depositor === '0x0000000000000000000000000000000000000000') {
      // No depositor - call deposit() first
      console.log('No depositor registered. Calling deposit()...');

      const depositTx = await walletClient.writeContract({
        address: OLD_CONTRACT,
        abi: ABI,
        functionName: 'deposit',
        args: [ethscriptionId],
      });
      console.log('Deposit TX:', depositTx);

      // Wait for confirmation
      console.log('Waiting for confirmation...');
      await publicClient.waitForTransactionReceipt({ hash: depositTx });
      console.log('Deposit confirmed!');
    } else if (depositor.toLowerCase() === account.address.toLowerCase()) {
      console.log('Already registered as depositor.');
    } else {
      console.log('ERROR: Someone else is registered as depositor!');
      continue;
    }

    // Now call cancelAndWithdraw
    console.log('Calling cancelAndWithdraw()...');
    const withdrawTx = await walletClient.writeContract({
      address: OLD_CONTRACT,
      abi: ABI,
      functionName: 'cancelAndWithdraw',
      args: [ethscriptionId],
    });
    console.log('Withdraw TX:', withdrawTx);

    console.log('Waiting for confirmation...');
    await publicClient.waitForTransactionReceipt({ hash: withdrawTx });
    console.log('Withdrawn! Ethscription rescued.');
  }

  console.log('\n=== All done! ===');
}

main().catch(console.error);
