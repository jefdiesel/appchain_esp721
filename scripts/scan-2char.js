const crypto = require('crypto');

const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
const API = 'https://api.ethscriptions.com/v2/ethscriptions/exists/0x';

async function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function checkName(name) {
  const hash = await sha256(`data:,${name}`);
  try {
    const res = await fetch(`${API}${hash}`);
    const data = await res.json();
    if (!data.result?.exists) {
      console.log(name);
    }
  } catch (e) {
    // retry later
  }
}

async function main() {
  const batch = [];

  for (let i = 0; i < chars.length; i++) {
    for (let j = 0; j < chars.length; j++) {
      const name = chars[i] + chars[j];
      batch.push(name);
    }
  }

  console.error(`Checking ${batch.length} 2-char names...`);

  // Process in batches of 50 concurrent requests
  for (let i = 0; i < batch.length; i += 50) {
    const chunk = batch.slice(i, i + 50);
    await Promise.all(chunk.map(checkName));
    console.error(`Progress: ${Math.min(i + 50, batch.length)}/${batch.length}`);
  }
}

main();
