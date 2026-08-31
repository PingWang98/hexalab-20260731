let heroesData = [];
let selectedHero = null;
let currentTierFilter = "all";
let minSampleFilter = 500;

// ARAM Mayhem augment rarity is keyed by the stable augment ID (`slug` in our
// dataset).  Keep it separate from performance data: rarity can change between
// patches while the historical win-rate sample remains useful.
const AUGMENT_TIER_BY_SLUG = Object.freeze((() => {
  const tiers = {
    "棱彩阶": [1001, 1004, 1006, 1011, 1015, 1018, 1019, 1027, 1030, 1041, 1045, 1048, 1053, 1054, 1058, 1062, 1079, 1081, 1088, 1095, 1115, 1134, 1154, 1156, 1194, 1195, 1220, 1225, 1243, 1323, 1324, 1325, 1329, 1331, 1332, 1335, 1337, 1344, 1349, 1361, 1379, 1388, 1389, 1392, 1402, 1413, 1421, 2004, 2005, 2006, 2010, 2031, 2046, 2054, 2055, 2062, 2063, 2072, 2087, 2095, 2098, 2099, 2104, 2107, 2115, 2118, 2123, 2134, 2135, 2141, 12317],
    "黄金阶": [1002, 1005, 1013, 1020, 1029, 1036, 1038, 1047, 1061, 1063, 1067, 1068, 1071, 1072, 1074, 1077, 1084, 1092, 1098, 1103, 1104, 1113, 1116, 1118, 1129, 1133, 1141, 1149, 1150, 1151, 1152, 1180, 1211, 1238, 1301, 1311, 1322, 1326, 1328, 1336, 1345, 1353, 1356, 1358, 1373, 1375, 1384, 1390, 1401, 1403, 1420, 1996, 2032, 2034, 2042, 2043, 2064, 2065, 2077, 2078, 2080, 2082, 2083, 2089, 2091, 2096, 2100, 2102, 2103, 2111, 2116, 2119, 2128, 2129, 2132, 2133, 2137, 2139, 2140, 2143],
    "白银阶": [1007, 1022, 1025, 1026, 1028, 1034, 1037, 1044, 1046, 1051, 1056, 1057, 1060, 1073, 1076, 1080, 1087, 1097, 1105, 1112, 1136, 1138, 1170, 1181, 1187, 1204, 1205, 1206, 1214, 1237, 1305, 1308, 1314, 1315, 1318, 1319, 1320, 1333, 1347, 1348, 1386, 1404, 1415, 1416, 2009, 2016, 2018, 2024, 2026, 2073, 2076, 2088, 2125, 2127, 2131, 2136, 2138, 2144, 2157],
  };

  return Object.fromEntries(
    Object.entries(tiers).flatMap(([tier, ids]) => ids.map(id => [String(id), tier]))
  );
})());

function normalizeAugmentTiers(heroes) {
  heroes.forEach(hero => {
    hero.augments?.forEach(augment => {
      const tier = AUGMENT_TIER_BY_SLUG[String(augment.slug)];
      if (tier) augment.tier = tier;
    });
  });
}

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
    // The bundled historical dataset is retained as a local fallback only. The
    // public UI intentionally exposes just the heroes whose detail records were
    // refreshed from the current patch API, so stale entries cannot appear in
    // search or in the sidebar.
    await res.json();
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
    normalizeAugmentTiers(heroesData);
    
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
    sampleValLabel.textContent = `> ${minSampleFilter.toLocaleString()} 场`;
    if (selectedHero) {
      renderAugmentsTable();
    }
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
  document.getElementById("baseSample").textContent = hero.base_sample ? hero.base_sample.toLocaleString() : "官方未提供";
  
  const tagsContainer = document.getElementById("heroTags");
  tagsContainer.innerHTML = `
    <span class="badge tier-badge">版本层级: ${hero.tier || 'T1'}</span>
    ${hero.search_aliases ? `<span class="badge alias-badge">常用名: ${hero.search_aliases}</span>` : ''}
  `;

  renderAugmentsTable();
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

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-msg">在当前等阶/样本门槛(>${minSampleFilter}场)下无匹配数据</td></tr>`;
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
        <td class="name-cell">${a.name} ${timingBadge}</td>
        <td><span class="tier-tag ${a.tier}">${a.tier}</span></td>
        <td>${a.win_rate}%</td>
        <td><span class="delta-badge ${deltaClass}">${deltaStr}</span></td>
        <td>${a.sample.toLocaleString()} 场</td>
      </tr>
    `;
  }).join('');
}
