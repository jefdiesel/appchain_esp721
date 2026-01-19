const crypto = require('crypto');

const API = 'https://api.ethscriptions.com/v2/ethscriptions/exists/0x';

// Curated valuable Chinese characters
const CURATED = [
  // Numbers
  '零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万', '亿',
  // Zodiac
  '鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪',
  // Lucky/Wealth
  '福', '禄', '寿', '喜', '财', '金', '玉', '宝', '贵', '富', '运', '吉', '祥', '发',
  // Elements
  '金', '木', '水', '火', '土', '风', '雷', '电', '冰', '雪',
  // Colors
  '红', '橙', '黄', '绿', '青', '蓝', '紫', '黑', '白', '灰',
  // Nature
  '天', '地', '日', '月', '星', '云', '山', '海', '河', '湖', '林', '森', '花', '草', '树',
  // Animals
  '鸟', '鱼', '猫', '狐', '狼', '熊', '鹿', '象', '狮', '鹰', '凤', '龟', '鹤',
  // People
  '人', '王', '帝', '神', '仙', '佛', '圣', '侠', '君', '将',
  // Crypto/Tech related
  '链', '币', '矿', '块', '网', '码', '数', '算', '智', '能',
  // Love/Emotions
  '爱', '心', '情', '梦', '愿', '望', '念', '思', '忆',
  // Power/Strength
  '力', '强', '勇', '武', '战', '胜', '霸', '王', '皇', '雄',
  // Time
  '春', '夏', '秋', '冬', '年', '岁', '永', '恒', '久', '古', '今',
  // Common words (valuable single chars)
  '中', '国', '大', '小', '上', '下', '东', '西', '南', '北',
  '道', '德', '仁', '义', '礼', '智', '信', '忠', '孝', '和', '平',
  // Modern slang / internet culture
  '牛', '赞', '酷', '潮', '飒', '绝',
];

// Remove duplicates
const chars = [...new Set(CURATED)];

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
    batch.push(...chars);
  } else if (mode === 'double') {
    // 2-char combinations of curated chars
    for (const c1 of chars) {
      for (const c2 of chars) {
        batch.push(c1 + c2);
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
