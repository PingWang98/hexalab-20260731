import json, math, statistics, hashlib
from pathlib import Path
root=Path(__file__).resolve().parent
source=root.parent/'aramhex-data'
latest=json.loads((source/'latest.json').read_text(encoding='utf-8'))
data=source/latest['path']
def read(p): return json.loads(p.read_text(encoding='utf-8'))
folds=read(root.parent/'pool_research/ranked_weighted_loho_summary.json')
alpha=statistics.median(v['alpha'] for v in folds.values())
beta=statistics.median(v['beta'] for v in folds.values())
stats_file='bands/high/hero_augments.json' if latest.get('bands') else 'hero_augments.json'
for name in ['heroes.json','augments.json',stats_file]:
 if hashlib.sha256((data/name).read_bytes()).hexdigest()!=latest['files'][name]['sha256']: raise ValueError('Checksum mismatch: '+name)
heroes,catalog,stats=map(lambda n:read(data/n),['heroes.json','augments.json',stats_file])
out=[]
popular=set([hid for hid,h in sorted(heroes.items(),key=lambda x:-x[1]['games']) if hid!='22'][:10])
for hid,h in sorted(heroes.items(),key=lambda x:-x[1]['games']):
 if hid=='22':continue
 if h['win_rate']<=.5 and hid not in popular:continue
 cards=[]
 for aid,d in stats.get(hid,{}).items():
  if aid not in catalog or not d['games']:continue
  cards.append(dict(id=aid,name=catalog[aid]['name'],tier=catalog[aid]['rarity'],score=(d['wins']+3000*h['win_rate'])/(d['games']+3000),weight=d['games']**alpha*math.exp(-beta*(d['win_rate']-.5))))
 if not cards:raise ValueError('Missing high-band stats for '+hid)
 out.append(dict(id=hid,name=h['name'],win_rate=h['win_rate'],popular=hid in popular,cards=cards))
(root/'reroll-data.json').write_text(json.dumps(dict(patch=latest['patch'],sample_band='前 5%' if latest.get('bands') else '全体',model=dict(name='九英雄高频加权模型',alpha=alpha,beta=beta,records=235,heroes=9),heroes=out),ensure_ascii=False),encoding='utf-8')
