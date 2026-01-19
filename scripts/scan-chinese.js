const crypto = require('crypto');

const API = 'https://api.ethscriptions.com/v2/ethscriptions/exists/0x';

// CJK Unified Ideographs - common range (U+4E00 to U+9FFF)
// Start with first ~3000 most common characters
const START = 0x4E00;
const END = 0x9FFF; // Full range is ~20k chars

// You can adjust these for different scans:
// - For quick test: END = 0x4FFF (~500 chars)
// - For common chars: END = 0x5FFF (~4600 chars)
// - For full scan: END = 0x9FFF (~21000 chars)

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
  const mode = process.argv[2] || 'single'; // 'single' or 'double'
  const batch = [];

  if (mode === 'single') {
    // Single Chinese characters
    for (let code = START; code <= END; code++) {
      batch.push(String.fromCodePoint(code));
    }
  } else if (mode === 'double') {
    // 2-character Chinese combinations (warning: massive!)
    // Using smaller range for double chars
    const doubleEnd = Math.min(START + 500, END); // ~250k combos
    for (let i = START; i <= doubleEnd; i++) {
      for (let j = START; j <= doubleEnd; j++) {
        batch.push(String.fromCodePoint(i) + String.fromCodePoint(j));
      }
    }
  }

  console.error(`Checking ${batch.length} ${mode} Chinese names...`);

  // Process in batches of 50 concurrent requests
  for (let i = 0; i < batch.length; i += 50) {
    const chunk = batch.slice(i, i + 50);
    await Promise.all(chunk.map(checkName));
    console.error(`Progress: ${Math.min(i + 50, batch.length)}/${batch.length}`);
  }
}

main();
