let heroesData = [];
let selectedHero = null;
let currentTierFilter = "all";
let minSampleFilter = 500;

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setupEventListeners();
});

async function loadData() {
  const heroListContainer = document.getElementById("heroList");
  heroListContainer.innerHTML = '<div class="loading-spinner">正在读取海克斯数据库...</div>';
  
  try {
    const res = await fetch("all_heroes_data.json");
    if (!res.ok) throw new Error("Database not found");
    heroesData = await res.json();
    
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
        ${h.tier ? `<span class="autocomplete-hero-alias">版本 ${h.tier} | 胜率 ${h.base_win_rate}%</span>` : ''}
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

  // 2. Tier Filter Buttons: Auto-switch to Augments Tab & Filter
  document.querySelectorAll(".tier-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tier-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentTierFilter = btn.dataset.tier;
      
      // Auto-switch to Augments tab
      const tabAugmentsBtn = document.getElementById("tabAugmentsBtn");
      if (tabAugmentsBtn) tabAugmentsBtn.click();

      if (selectedHero) renderAugmentsTable();
    });
  });

  // Sample Threshold Range Input (Default >= 500 matches)
  const sampleInput = document.getElementById("sampleThreshold");
  const sampleValLabel = document.getElementById("sampleValue");
  sampleInput.addEventListener("input", (e) => {
    minSampleFilter = parseInt(e.target.value, 10);
    sampleValLabel.textContent = `> ${minSampleFilter.toLocaleString()} 场`;
    if (selectedHero) {
      renderAugmentsTable();
      renderItemsTable();
    }
  });

  // Tabs
  const tabAugmentsBtn = document.getElementById("tabAugmentsBtn");
  const tabItemsBtn = document.getElementById("tabItemsBtn");
  const panelAugments = document.getElementById("panelAugments");
  const panelItems = document.getElementById("panelItems");

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

function renderHeroList(list) {
  const container = document.getElementById("heroList");
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-msg">未找到匹配英雄</div>';
    return;
  }

  container.innerHTML = list.map(h => `
    <div class="hero-item ${selectedHero && selectedHero.slug === h.slug ? 'active' : ''}" data-slug="${h.slug}">
      <span class="hero-item-name">${h.display_name || h.name}</span>
      <span class="hero-item-tier">${h.tier || 'T1'} | ${h.base_win_rate}%</span>
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
  document.getElementById("baseSample").textContent = hero.base_sample ? hero.base_sample.toLocaleString() : "100,000+";
  
  const tagsContainer = document.getElementById("heroTags");
  tagsContainer.innerHTML = `
    <span class="badge tier-badge">版本层级: ${hero.tier || 'T1'}</span>
    ${hero.search_aliases ? `<span class="badge alias-badge">常用名: ${hero.search_aliases}</span>` : ''}
  `;

  renderAugmentsTable();
  renderItemsTable();
}

// Generate SVG Sparkline Line Chart for S1-S4 stage rankings
function generateSparklineSvg(stageRanks) {
  if (!stageRanks || Object.keys(stageRanks).length === 0) {
    return '<span style="color:#94a3b8; font-size:11px;">--</span>';
  }

  const r1 = stageRanks.S1 || 50;
  const r2 = stageRanks.S2 || 50;
  const r3 = stageRanks.S3 || 50;
  const r4 = stageRanks.S4 || 50;

  const ranks = [r1, r2, r3, r4];
  const maxR = Math.max(...ranks, 20);
  const minR = Math.min(...ranks, 1);

  const width = 130;
  const height = 28;
  const padding = 4;

  // Map ranks to Y coordinates (rank 1 is top Y=padding, maxR is bottom Y=height-padding)
  const getY = (rank) => {
    if (maxR === minR) return height / 2;
    const norm = (rank - minR) / (maxR - minR);
    return padding + norm * (height - 2 * padding);
  };

  const points = [
    { x: 10, y: getY(r1), rank: r1, label: 'S1' },
    { x: 48, y: getY(r2), rank: r2, label: 'S2' },
    { x: 84, y: getY(r3), rank: r3, label: 'S3' },
    { x: 120, y: getY(r4), rank: r4, label: 'S4' }
  ];

  const pathD = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y}`;
  const strokeColor = (r1 <= r4) ? '#10b981' : '#f43f5e'; // Green if early better, Rose if scaling up

  const dotsHtml = points.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="3" fill="${strokeColor}" stroke="#0f172a" stroke-width="1">
      <title>${p.label}: #${p.rank}</title>
    </circle>
  `).join('');

  return `
    <div class="sparkline-box" title="S1:#${r1} | S2:#${r2} | S3:#${r3} | S4:#${r4}">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${dotsHtml}
      </svg>
      <div class="sparkline-labels">
        <span>S1:#${r1}</span>
        <span>S4:#${r4}</span>
      </div>
    </div>
  `;
}

function renderAugmentsTable() {
  const tbody = document.getElementById("augmentsTbody");
  if (!selectedHero || !selectedHero.augments) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">暂无海克斯数据</td></tr>';
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

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-msg">在当前等阶/样本门槛(>${minSampleFilter}场)下无匹配数据</td></tr>`;
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

    // 2. SVG Sparkline Line Chart for S1-S4 stage rankings
    const sparklineHtml = generateSparklineSvg(a.stage_ranks);

    return `
      <tr>
        <td class="rank-cell">#${idx + 1}</td>
        <td class="name-cell">${a.name} ${timingBadge}</td>
        <td><span class="tier-tag ${a.tier}">${a.tier}</span></td>
        <td><strong>${a.hexscore}</strong></td>
        <td>${a.win_rate}%</td>
        <td><span class="delta-badge ${deltaClass}">${deltaStr}</span></td>
        <td>${sparklineHtml}</td>
        <td>${a.sample.toLocaleString()} 场</td>
      </tr>
    `;
  }).join('');
}

function renderItemsTable() {
  const tbody = document.getElementById("itemsTbody");
  if (!selectedHero || !selectedHero.items) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">暂无装备数据</td></tr>';
    return;
  }

  let list = selectedHero.items.filter(i => i.sample >= minSampleFilter);
  list.sort((a, b) => b.delta - a.delta);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">在当前样本门槛(>${minSampleFilter}场)下无匹配装备数据</td></tr>`;
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
        <td><strong>${item.hexscore}</strong></td>
        <td>${item.win_rate}%</td>
        <td><span class="delta-badge ${deltaClass}">${deltaStr}</span></td>
        <td>${item.sample.toLocaleString()} 场</td>
      </tr>
    `;
  }).join('');
}
