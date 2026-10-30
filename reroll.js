// Deterministic weighted sampling without replacement. Estimates are scenarios,
// not observations of the game's offer distribution.
function rerollChance(pool, score, draws) {
  if (!draws || !pool.length) return 0;
  if (!pool.some(c => c.score > score)) return 0;
  if (draws >= pool.length) return 1;
  let seed = 42173, hits = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let trial = 0; trial < 12000; trial++) {
    const remaining = pool.slice();
    let total = remaining.reduce((sum,c) => sum+c.weight,0);
    for (let n = 0; n < draws && remaining.length; n++) {
      let target = random()*total, index = remaining.length-1;
      for (let j=0;j<remaining.length;j++) { target-=remaining[j].weight; if(target<0){ index=j; break; } }
      const card = remaining.splice(index,1)[0]; total-=card.weight;
      if(card.score>score){ hits++; break; }
    }
  }
  return hits/12000;
}
if (typeof module !== 'undefined') module.exports = {rerollChance};
if (typeof document !== 'undefined') (async () => {
  const get = id => document.getElementById(id);
  const heroSelect=get('rrHero'), cardSelect=get('rrCard'), count=get('rrCount');
  let heroes=[];
  function hero(){return heroes.find(h=>h.id===heroSelect.value);}
  function card(){return hero().cards.find(c=>c.id===cardSelect.value);}
  function calculate(){
    const n=Number(count.value);
    if(count.value==='' || !Number.isInteger(n) || n<0 || n>10){get('rrResult').textContent='请输入 0–10 之间的整数次数'; get('rrDetail').textContent='';return;}
    const current=card();
    const seen=new Set([...get('rrSeen').querySelectorAll('input:checked')].map(e=>e.value));
    const pool=hero().cards.filter(c=>c.tier===current.tier && c.id!==current.id && !seen.has(c.id));
    const probability=rerollChance(pool,current.score,n);
    get('rrResult').textContent=probability>0.5 ? '是 · 建议尝试刷新' : '否 · 建议保留当前海克斯';
    get('rrResult').dataset.yes=String(probability>0.5);
    get('rrDetail').textContent=`用完 ${n} 次刷新，遇到至少一个更好海克斯的模型估计：约 ${Math.round(probability*100)}%。${n===0?'没有剩余刷新机会。':pool.length===0?'没有可用的已知候选。':''}这是估计，不是保证。`;
  }
  function updateSeen(){
    const old=new Set([...get('rrSeen').querySelectorAll('input:checked')].map(e=>e.value));
    get('rrSeen').replaceChildren();
    for(const c of hero().cards.filter(c=>c.tier===card().tier && c.id!==card().id)){
      const label=document.createElement('label'), checkbox=document.createElement('input');
      checkbox.type='checkbox';checkbox.value=c.id;checkbox.checked=old.has(c.id);checkbox.addEventListener('change',calculate);
      label.append(checkbox,document.createTextNode(c.name));get('rrSeen').append(label);
    }
    calculate();
  }
  function updateHero(){
    cardSelect.replaceChildren();get('rrSeen').replaceChildren();
    const labels={silver:'银色',gold:'金色',prismatic:'彩色'};
    for(const tier of ['silver','gold','prismatic']){
      const group=document.createElement('optgroup');group.label=labels[tier];
      for(const c of hero().cards.filter(c=>c.tier===tier).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')))group.append(new Option(c.name,c.id));
      cardSelect.append(group);
    }
    updateSeen();
  }
  try{
    const response=await fetch('reroll-data.json');if(!response.ok)throw Error('load');
    heroes=(await response.json()).heroes;
    for(const h of heroes)heroSelect.append(new Option(h.name,h.id));
    heroSelect.disabled=false;cardSelect.disabled=false;
    heroSelect.addEventListener('change',updateHero);cardSelect.addEventListener('change',updateSeen);count.addEventListener('input',calculate);updateHero();
  }catch(error){get('rrResult').textContent='刷新模型加载失败，请刷新页面重试。';}
})();
