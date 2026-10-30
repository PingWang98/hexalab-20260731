let heroesData = [];
let selectedHero = null;
let currentTierFilter = "all";
let minSampleFilter = 0;
let augmentCatalog = [];

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setupEventListeners();
});

async function loadData() {
  const heroListContainer = document.getElementById("heroList");
  heroListContainer.innerHTML = '<div class="loading-spinner">正在读取海克斯数据库...</div>';
  
  try {
    const latestRes = await fetch("latest_top_heroes.json");
    if (latestRes.ok) {
      const latestHeroes = await latestRes.json();
      heroesData = latestHeroes
        .filter(hero => hero && Number.isFinite(Number(hero.base_win_rate)))
        .sort((a, b) => Number(b.base_win_rate) - Number(a.base_win_rate));
    } else {
      // Do not present an unlabelled mixture of old and new records if the live
      // snapshot is unavailable.
      heroesData = [];
    }
    const metaRes = await fetch("data_meta.json");
    if (metaRes.ok) {
      const meta = await metaRes.json();
      augmentCatalog = meta.augments || [];
      const date = value => value.slice(0, 16).replace("T", " ");
      document.getElementById("dataSubtitle").textContent = `国服常规 · ${meta.hero_count} 位英雄 · 样本 ${date(meta.window.start)} 至 ${date(meta.window.end_exclusive)}（北京时间）`;
      document.getElementById("dataBadge").textContent = `Patch ${meta.patch} · 截至 ${date(meta.snapshot_at)}`;
    }
    
    renderHeroList(heroesData);
    
    if (heroesData.length > 0) {
      selectHero(heroesData[0]);
    }
  } catch (err) {
    heroListContainer.innerHTML = '<div class="empty-msg">数据库构建中，请稍后刷新页面...</div>';
    console.error(err);
  }
}

function filterHeroesByQuery(query) {
  if (!query) return heroesData;
  const q = query.toLowerCase().trim();

  return heroesData.filter(h => {
    const nameMatch = h.name.toLowerCase().includes(q);
    const aliasesMatch = h.search_aliases && h.search_aliases.toLowerCase().includes(q);
    const oldAliasesMatch = h.aliases && (Array.isArray(h.aliases) ? h.aliases.join(',').toLowerCase().includes(q) : String(h.aliases).toLowerCase().includes(q));
    const slugMatch = h.slug && h.slug.toLowerCase().includes(q);
    const idMatch = String(h.id || '').includes(q);

    return nameMatch || aliasesMatch || oldAliasesMatch || slugMatch || idMatch;
  });
}

function setupEventListeners() {
  const searchInput = document.getElementById("heroSearchInput");
  const dropdown = document.getElementById("autocompleteDropdown");

  // 1. Instant Real-time Autocomplete Dropdown & Search List
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value;
    const filtered = filterHeroesByQuery(query);
    
    renderHeroList(filtered);

    if (!query.trim() || filtered.length === 0) {
      dropdown.classList.add("hidden");
      return;
    }

    // Render autocomplete dropdown suggestions
    dropdown.innerHTML = filtered.slice(0, 12).map(h => `
      <div class="autocomplete-item" data-slug="${h.slug}">
        <span class="autocomplete-hero-name">${h.display_name || h.name}</span>
        <span class="autocomplete-hero-alias">胜率 ${h.base_win_rate}%</span>
      </div>
    `).join('');

    dropdown.classList.remove("hidden");

    dropdown.querySelectorAll(".autocomplete-item").forEach(item => {
      item.addEventListener("click", () => {
        const hero = heroesData.find(h => h.slug === item.dataset.slug);
        if (hero) {
          searchInput.value = hero.name;
          selectHero(hero);
          dropdown.classList.add("hidden");
        }
      });
    });
  });

  // Close autocomplete dropdown on click outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box-wrapper")) {
      dropdown.classList.add("hidden");
    }
  });

  // Tier filter buttons
  document.querySelectorAll(".tier-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tier-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentTierFilter = btn.dataset.tier;
      
      if (selectedHero) renderAugmentsTable();
    });
  });

  // Sample Threshold Range Input (Default >= 500 matches)
  const sampleInput = document.getElementById("sampleThreshold");
  const sampleValLabel = document.getElementById("sampleValue");
  sampleInput.addEventListener("input", (e) => {
    minSampleFilter = parseInt(e.target.value, 10);
    sampleValLabel.textContent = `≥ ${minSampleFilter.toLocaleString()} 场`;
    if (selectedHero) {
      renderAugmentsTable();
      renderItemsTable();
    }
  });

  // Tab switcher
  const tabAugmentsBtn = document.getElementById("tabAugmentsBtn");
  const tabItemsBtn = document.getElementById("tabItemsBtn");
  const panelAugments = document.getElementById("panelAugments");
  const panelItems = document.getElementById("panelItems");

  if (tabAugmentsBtn && tabItemsBtn) {
    tabAugmentsBtn.addEventListener("click", () => {
      tabAugmentsBtn.classList.add("active");
      tabItemsBtn.classList.remove("active");
      panelAugments.classList.add("active");
      panelItems.classList.remove("active");
    });

    tabItemsBtn.addEventListener("click", () => {
      tabItemsBtn.classList.add("active");
      tabAugmentsBtn.classList.remove("active");
      panelItems.classList.add("active");
      panelAugments.classList.remove("active");
    });
  }
}

function renderHeroList(list) {
  const container = document.getElementById("heroList");
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-msg">未找到匹配英雄</div>';
    return;
  }

  container.innerHTML = list.map(h => `
    <div class="hero-item ${selectedHero && selectedHero.slug === h.slug ? 'active' : ''}" data-slug="${h.slug}">
      <span class="hero-item-name">${h.display_name || h.name}</span>
      <span class="hero-item-tier">胜率 ${h.base_win_rate}%</span>
    </div>
  `).join('');

  container.querySelectorAll(".hero-item").forEach(item => {
    item.addEventListener("click", () => {
      const hero = heroesData.find(h => h.slug === item.dataset.slug);
      if (hero) {
        document.querySelectorAll(".hero-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        selectHero(hero);
      }
    });
  });
}

function selectHero(hero) {
  selectedHero = hero;
  
  document.getElementById("heroName").textContent = hero.display_name || hero.name;
  document.getElementById("baseWinRate").textContent = `${hero.base_win_rate}%`;
  document.getElementById("baseSample").textContent = hero.base_sample ? hero.base_sample.toLocaleString() : "官方未提供";
  
  const tagsContainer = document.getElementById("heroTags");
  tagsContainer.innerHTML = `
    <span class="badge tier-badge">胜率排名: #${hero.rank}</span>
    ${hero.search_aliases ? `<span class="badge alias-badge">常用名: ${hero.search_aliases}</span>` : ''}
  `;

  renderAugmentsTable();
  renderItemsTable();
}

function renderAugmentsTable() {
  const tbody = document.getElementById("augmentsTbody");
  if (!selectedHero || !selectedHero.augments) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">暂无海克斯数据</td></tr>';
    return;
  }

  let list = selectedHero.augments;

  // Filter by Tier (Prismatic / Gold / Silver)
  if (currentTierFilter !== "all") {
    list = list.filter(a => a.tier === currentTierFilter);
  }

  // Filter strictly by Sample Size (Default >= 500 matches)
  list = list.filter(a => a.sample >= minSampleFilter);
  
  // Sort strictly by Win Rate Gain (delta) descending
  list.sort((a, b) => b.delta - a.delta);

  const observedIds = new Set(selectedHero.augments.map(a => String(a.slug)));
  const unobserved = augmentCatalog.filter(a => !observedIds.has(String(a.id)));
  document.getElementById("augmentCounts").textContent = `本英雄有统计 ${selectedHero.augments.length} 种；当前筛选显示 ${list.length} 种；数据目录中另有 ${unobserved.length} 种未提供该英雄的统计。`;
  document.getElementById("unobservedAugments").textContent = unobserved.map(a => `${a.name}（${a.tier}）`).join('、') || '无';

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">在当前等阶/样本门槛(≥${minSampleFilter}场)下无匹配数据</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((a, idx) => {
    const isPositive = a.delta >= 0;
    const deltaStr = isPositive ? `+${a.delta.toFixed(1)}%` : `${a.delta.toFixed(1)}%`;
    const deltaClass = isPositive ? 'positive' : 'negative';

    // 1. Timing Tag Warning ONLY IF difference is LARGE (⚡ 前期压制 / ⌛ 后期战神)
    let timingBadge = '';
    if (a.timing_tag) {
      timingBadge = `<span class="timing-badge timing-${a.timing_class}">${a.timing_tag}</span>`;
    }

    return `
      <tr>
        <td class="rank-cell">#${idx + 1}</td>
        <td class="name-cell">${a.name} ${a.low_sample ? '<span class="badge alias-badge">小样本</span>' : ''} ${timingBadge}</td>
        <td><span class="tier-tag ${a.tier}">${a.tier}</span></td>
        <td>${a.win_rate}%</td>
        <td><span class="delta-badge ${deltaClass}">${deltaStr}</span></td>
        <td>${a.sample.toLocaleString()} 场</td>
      </tr>
    `;
  }).join('');
}


function renderItemsTable() {
  const tbody = document.getElementById("itemsTbody");
  if (!tbody) return;
  if (!selectedHero || !selectedHero.items || selectedHero.items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">当前数据源未提供装备统计</td></tr>';
    return;
  }

  let list = selectedHero.items.filter(i => (i.sample || 0) >= minSampleFilter);
  // Sort strictly by win rate gain delta descending, then winRate desc
  list.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0) || (b.win_rate ?? 0) - (a.win_rate ?? 0));

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">在当前样本门槛(≥${minSampleFilter}场)下无匹配装备数据</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((item, idx) => {
    const isPositive = item.delta >= 0;
    const deltaStr = isPositive ? `+${item.delta.toFixed(1)}%` : `${item.delta.toFixed(1)}%`;
    const deltaClass = isPositive ? 'positive' : 'negative';

    return `
      <tr>
        <td class="rank-cell">#${idx + 1}</td>
        <td class="name-cell">${item.name}</td>
        <td>${item.win_rate}%</td>
        <td><span class="delta-badge ${deltaClass}">${deltaStr}</span></td>
        <td>${item.sample.toLocaleString()} 场</td>
      </tr>
    `;
  }).join('');
}
