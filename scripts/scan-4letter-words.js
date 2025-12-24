const fs = require('fs');
const crypto = require('crypto');

const API = 'https://api.ethscriptions.com/v2/ethscriptions/exists/0x';

// Get 4-letter lowercase words from dictionary
const words = fs.readFileSync('/usr/share/dict/words', 'utf8')
  .split('\n')
  .filter(word => /^[a-z]{4}$/.test(word));

console.error(`Checking ${words.length} 4-letter words...`);

async function checkWord(word) {
  const hash = crypto.createHash('sha256').update(`data:,${word}`).digest('hex');
  try {
    const res = await fetch(`${API}${hash}`);
    const data = await res.json();
    if (!data.result?.exists) {
      console.log(word); // AVAILABLE
    }
  } catch (e) {}
}

async function main() {
  for (let i = 0; i < words.length; i += 50) {
    const batch = words.slice(i, i + 50);
    await Promise.all(batch.map(checkWord));
    console.error(`Progress: ${Math.min(i + 50, words.length)}/${words.length}`);
  }
}

main();
