import json, math, statistics
from pathlib import Path
root=Path(__file__).resolve().parent
data=root.parent/'aramhex-data/patches/16.21/normal'
def read(p): return json.loads(p.read_text(encoding='utf-8'))
folds=read(root.parent/'pool_research/ranked_weighted_loho_summary.json')
alpha=statistics.median(v['alpha'] for v in folds.values())
beta=statistics.median(v['beta'] for v in folds.values())
heroes,catalog,stats=map(lambda n:read(data/n),['heroes.json','augments.json','bands/high/hero_augments.json'])
out=[]
for hid,h in sorted(heroes.items(),key=lambda x:-x[1]['games']):
 if hid=='22':continue
 cards=[]
 for aid,d in stats.get(hid,{}).items():
  if aid not in catalog or not d['games']:continue
  cards.append(dict(id=aid,name=catalog[aid]['name'],tier=catalog[aid]['rarity'],score=(d['wins']+3000*h['win_rate'])/(d['games']+3000),weight=d['games']**alpha*math.exp(-beta*(d['win_rate']-.5))))
 out.append(dict(id=hid,name=h['name'],cards=cards))
 if len(out)==10:break
(root/'reroll-data.json').write_text(json.dumps(dict(patch='16.21',model=dict(name='九英雄高频加权模型',alpha=alpha,beta=beta,records=235,heroes=9),heroes=out),ensure_ascii=False),encoding='utf-8')
