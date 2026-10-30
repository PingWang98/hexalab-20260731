import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(process.argv[2] || path.join(root, '..', 'aramhex-data'));
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const latest = read(path.join(source, 'latest.json'));
if (!/^patches\/[\w.-]+\/normal$/.test(latest.path)) throw new Error('Invalid latest dataset path');
const dir = path.join(source, latest.path);
const load = name => {
  const bytes = fs.readFileSync(path.join(dir, name));
  const expected = latest.files[name]?.sha256;
  if (!expected || crypto.createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Checksum mismatch: ${name}`);
  return JSON.parse(bytes);
};
const heroes = load('heroes.json');
const pairs = load('hero_augments.json');
const augments = load('augments.json');
const meta = load('meta.json');
const old = read(path.join(root, 'all_heroes_data.json'));
const previous = read(path.join(root, 'latest_top_heroes.json'));
const lookup = new Map([...old, ...previous].map(h => [String(h.id), h]));
const rarity = { silver: '白银阶', gold: '黄金阶', prismatic: '棱彩阶' };
const round = n => Math.round(n * 100) / 100;
const output = Object.entries(heroes).map(([id, h]) => {
  const legacy = lookup.get(id) || {};
  const aliases = [...new Set([...(Array.isArray(legacy.aliases) ? legacy.aliases : []), h.title].filter(Boolean))];
  const base = round(h.win_rate * 100);
  return { id: Number(id), slug: legacy.slug || id, name: h.name, display_name: h.name,
    aliases, search_aliases: aliases.join(', '), rank: h.rank, base_win_rate: base, base_sample: h.games,
    augments: Object.entries(pairs[id] || {}).map(([aid, stat]) => {
      const info = augments[aid];
      if (!info || !rarity[info.rarity]) throw new Error(`Missing augment metadata: ${aid}`);
      return { slug: aid, name: info.name, tier: rarity[info.rarity], win_rate: round(stat.win_rate * 100),
        sample: stat.games, delta: round((stat.win_rate - h.win_rate) * 100), low_sample: stat.low_sample };
    }), items: [] };
}).sort ( (a, b) => b.base_win_rate - a.base_win_rate);
if (!output.length || output.some(h => !h.augments.length)) throw new Error('Incomplete dataset');
fs.writeFileSync(path.join(root, 'latest_top_heroes.json'), JSON.stringify(output));
fs.writeFileSync(path.join(root, 'data_meta.json'), JSON.stringify({ patch: meta.patch || latest.path.split('/')[1], snapshot_at: meta.snapshot_at, window: meta.window, valid_matches: meta.matches.valid, hero_count: output.length, seq: latest.seq }, null, 2) + '\n');
console.log(`Synced ${output.length} heroes from ${latest.path}, seq ${latest.seq}`);
