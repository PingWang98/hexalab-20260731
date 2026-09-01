import fs from 'fs';
import path from 'path';

const PROJECT_DIR = 'C:\\Users\\admin\\Documents\\ChatGPT\\New project';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Referer': 'https://hexdata.com.cn/heroes',
  'Accept': 'application/json, text/plain, */*'
};

const RARITY_MAP = {
  '棱彩': '棱彩阶',
  '黄金': '黄金阶',
  '白银': '白银阶',
  '棱彩阶': '棱彩阶',
  '黄金阶': '黄金阶',
  '白银阶': '白银阶'
};

// Concurrency pool helper
async function mapConcurrent(items, limit, fn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function calculateTimingTag(stages) {
  if (!Array.isArray(stages) || stages.length < 2) {
    return { timing_tag: '', timing_class: '' };
  }
  const s1 = stages.find(s => s.stage === 1)?.winRate;
  const s4 = stages.find(s => s.stage === 4)?.winRate;
  if (Number.isFinite(s1) && Number.isFinite(s4)) {
    const diff = s4 - s1;
    if (diff >= 0.035) {
      return { timing_tag: '⌛ 后期战神', timing_class: 'late' };
    } else if (diff <= -0.035) {
      return { timing_tag: '⚡ 前期压制', timing_class: 'early' };
    }
  }
  return { timing_tag: '', timing_class: '' };
}

async function main() {
  console.log('1. Loading existing legacy hero metadata from all_heroes_data.json...');
  let legacyMap = new Map();
  try {
    const legacyRaw = fs.readFileSync(path.join(PROJECT_DIR, 'all_heroes_data.json'), 'utf8');
    const legacyList = JSON.parse(legacyRaw);
    for (const h of legacyList) {
      legacyMap.set(String(h.id), h);
      if (h.slug) legacyMap.set(h.slug.toLowerCase(), h);
    }
  } catch (e) {
    console.warn('Warning: Could not read all_heroes_data.json:', e.message);
  }

  console.log('2. Fetching champion list from https://hexdata.com.cn/data/heroes.json...');
  const heroesRes = await fetch('https://hexdata.com.cn/data/heroes.json', { headers: HEADERS });
  if (!heroesRes.ok) throw new Error(`Failed to fetch heroes: ${heroesRes.status}`);
  const heroesList = await heroesRes.json();
  console.log(`Found ${heroesList.length} heroes from Hexdata.`);

  // Sort heroes by win rate descending
  heroesList.sort((a, b) => (b.winRate || 0) - (a.winRate || 0));

  console.log('3. Fetching detailed hero stats, augments and items with concurrency 12...');
  let completed = 0;
  const detailedHeroes = await mapConcurrent(heroesList, 12, async (h) => {
    const heroId = String(h.id);
    const legacy = legacyMap.get(heroId) || legacyMap.get(h.seoSlug?.toLowerCase());
    
    // Fetch hero details
    let detail = null;
    try {
      const res = await fetch(`https://hexdata.com.cn/data/heroes/${heroId}.json`, { headers: HEADERS });
      if (res.ok) {
        detail = await res.json();
      } else {
        console.error(`Failed to fetch details for ${h.name} (${heroId}): HTTP ${res.status}`);
      }
    } catch (err) {
      console.error(`Error fetching details for ${h.name} (${heroId}):`, err.message);
    }

    completed++;
    if (completed % 25 === 0 || completed === heroesList.length) {
      console.log(`Progress: ${completed}/${heroesList.length} heroes fetched.`);
    }

    const baseWinRate = Number((h.winRate * 100).toFixed(2));
    const baseSample = h.games || 0;

    // Process Augments
    const augmentsRaw = detail?.augments || [];
    const augments = augmentsRaw.map(a => {
      const rawWr = a.pairWinRate ?? a.winRate ?? (a.games ? a.wins / a.games : 0);
      const winRate = Number((rawWr * 100).toFixed(2));
      const delta = Number((winRate - baseWinRate).toFixed(2));
      const rarityName = RARITY_MAP[a.rarity] || a.rarity || '未知';
      const timing = calculateTimingTag(a.stages);

      return {
        slug: String(a.augmentId || a.id),
        name: a.augmentName || a.name || '未知海克斯',
        tier: rarityName,
        hexscore: Number((a.hexScore || 0).toFixed(1)),
        hex_label: a.hexLabel || (a.games < 50 ? '样本过少' : ''),
        win_rate: winRate,
        sample: a.games || 0,
        delta: delta,
        stage_ranks: null,
        timing_tag: timing.timing_tag,
        timing_class: timing.timing_class,
        source_rank: a.tier || null
      };
    });

    // Process Items
    const itemsRaw = detail?.items || [];
    const items = itemsRaw.map(item => {
      const rawWr = item.winRate ?? (item.games ? item.wins / item.games : 0);
      const winRate = Number((rawWr * 100).toFixed(2));
      const delta = Number((winRate - baseWinRate).toFixed(2));

      return {
        id: String(item.itemId || ''),
        name: item.itemName || item.name || '未知装备',
        hexscore: Number((item.hexScore || winRate).toFixed(1)),
        hex_label: item.hexLabel || '',
        win_rate: winRate,
        sample: item.games || 0,
        delta: delta,
        pick_rate: Number(((item.pickRate || 0) * 100).toFixed(1))
      };
    });

    // Merge search aliases
    const aliasesSet = new Set();
    if (legacy?.aliases) {
      (Array.isArray(legacy.aliases) ? legacy.aliases : [legacy.aliases]).forEach(a => aliasesSet.add(a));
    }
    if (h.searchTerms) {
      h.searchTerms.forEach(t => aliasesSet.add(t));
    }
    const aliasesList = [...aliasesSet];
    const searchAliases = aliasesList.join(', ');

    return {
      id: Number(heroId),
      slug: legacy?.slug || h.seoSlug || String(h.id),
      name: h.name,
      display_name: legacy?.display_name || (aliasesList.length > 0 ? `${h.name} (${aliasesList[0]})` : h.name),
      aliases: aliasesList,
      search_aliases: searchAliases,
      tier: `T${h.tier || 1}`,
      base_win_rate: baseWinRate,
      base_sample: baseSample,
      augments: augments,
      items: items,
      data_patch: h.patch || '16.17',
      data_version: '2026-08-29'
    };
  });

  console.log(`4. Successfully processed ${detailedHeroes.length} heroes.`);
  
  // Write output to latest_top_heroes.json with UTF-8 encoding
  const outputPath = path.join(PROJECT_DIR, 'latest_top_heroes.json');
  fs.writeFileSync(outputPath, JSON.stringify(detailedHeroes, null, 2), 'utf8');
  const stat = fs.statSync(outputPath);
  console.log(`Wrote ${outputPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB).`);
}

main().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
