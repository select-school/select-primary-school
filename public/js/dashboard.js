import { getAppState, showDetailModal } from './shared.js';
import { navigateTo } from './router.js';
import { applyRankingFilters } from './ranking.js';

export function initDashboard() {
  const container = document.getElementById('dashboard-cards');
  if (!container) return;
  container.innerHTML = '';

  renderShortlistCard(container);
  renderRegionCard(container);
  renderTypeCard(container);
  renderDistrictChart(container);
  renderTuitionChart(container);
}

function renderShortlistCard(container) {
  const allSchools = getAppState('allSchools');
  const rated = allSchools.filter(s => s.userData?.rating);

  if (rated.length === 0) return;

  const tierOrder = { Top: 0, High: 1, Medium: 2 };
  rated.sort((a, b) => {
    const ta = tierOrder[a.userData.rating] ?? 3;
    const tb = tierOrder[b.userData.rating] ?? 3;
    return ta - tb || a.rank - b.rank;
  });

  const top5 = rated.slice(0, 5);
  const card = createCard('我的心水學校', `${rated.length} 所已評級`);

  const list = document.createElement('div');
  list.className = 'space-y-2';
  top5.forEach(school => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between p-2 rounded-lg hover:bg-base-200 cursor-pointer';
    row.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="font-mono text-sm text-base-content/50">#${school.rank}</span>
        <span class="text-sm font-medium">${school.name}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-base-content/50">${school.district}</span>
        ${ratingBadgeInline(school.userData.rating)}
      </div>
    `;
    row.addEventListener('click', () => showDetailModal(school));
    list.appendChild(row);
  });

  card.appendChild(list);
  container.appendChild(card);
}

function renderRegionCard(container) {
  const prefs = getAppState('preferences');
  const allSchools = getAppState('allSchools');

  if (!prefs.districts?.length && !prefs.schoolNets?.length) {
    container.appendChild(createPlaceholderCard('地區推薦', '設定你的地區偏好', '#account'));
    return;
  }

  const filtered = allSchools.filter(s => {
    if (prefs.districts?.length && prefs.districts.includes(s.district)) return true;
    if (prefs.schoolNets?.length) {
      return (s.schoolNet || []).some(n => prefs.schoolNets.includes(n));
    }
    return false;
  }).sort((a, b) => a.rank - b.rank);

  const top10 = filtered.slice(0, 10);
  const card = createCard('地區推薦', `${filtered.length} 所學校`);

  const list = document.createElement('div');
  list.className = 'space-y-1';
  top10.forEach(school => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between p-2 rounded-lg hover:bg-base-200 cursor-pointer';
    row.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="font-mono text-sm text-base-content/50">#${school.rank}</span>
        <span class="text-sm">${school.name}</span>
      </div>
      <span class="text-xs text-base-content/50">${school.district}</span>
    `;
    row.addEventListener('click', () => showDetailModal(school));
    list.appendChild(row);
  });

  if (filtered.length > 10) {
    const viewAll = document.createElement('button');
    viewAll.className = 'btn btn-ghost btn-sm w-full mt-2';
    viewAll.textContent = `查看全部 (${filtered.length})`;
    viewAll.addEventListener('click', () => {
      navigateTo('#ranking');
      setTimeout(() => applyRankingFilters({
        districts: prefs.districts || [],
        nets: prefs.schoolNets || [],
      }), 50);
    });
    list.appendChild(viewAll);
  }

  card.appendChild(list);
  container.appendChild(card);
}

function renderTypeCard(container) {
  const prefs = getAppState('preferences');
  const allSchools = getAppState('allSchools');

  if (!prefs.schoolTypes?.length) {
    container.appendChild(createPlaceholderCard('學校類型', '設定學校類型偏好', '#account'));
    return;
  }

  const filtered = allSchools.filter(s => prefs.schoolTypes.includes(s.gender))
    .sort((a, b) => a.rank - b.rank);

  const top10 = filtered.slice(0, 10);
  const card = createCard('學校類型', `${filtered.length} 所 ${prefs.schoolTypes.join(' / ')}`);

  const list = document.createElement('div');
  list.className = 'space-y-1';
  top10.forEach(school => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between p-2 rounded-lg hover:bg-base-200 cursor-pointer';
    row.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="font-mono text-sm text-base-content/50">#${school.rank}</span>
        <span class="text-sm">${school.name}</span>
      </div>
      <span class="text-xs text-base-content/50">${school.gender}</span>
    `;
    row.addEventListener('click', () => showDetailModal(school));
    list.appendChild(row);
  });

  if (filtered.length > 10) {
    const viewAll = document.createElement('button');
    viewAll.className = 'btn btn-ghost btn-sm w-full mt-2';
    viewAll.textContent = `查看全部 (${filtered.length})`;
    viewAll.addEventListener('click', () => {
      navigateTo('#ranking');
      setTimeout(() => applyRankingFilters({ gender: prefs.schoolTypes[0] }), 50);
    });
    list.appendChild(viewAll);
  }

  card.appendChild(list);
  container.appendChild(card);
}

function renderDistrictChart(container) {
  const allSchools = getAppState('allSchools');
  const prefs = getAppState('preferences');
  const prefDistricts = new Set(prefs.districts || []);

  const counts = {};
  allSchools.forEach(s => {
    counts[s.district] = (counts[s.district] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;

  const card = createCard('地區分佈', `${allSchools.length} 所學校，${Object.keys(counts).length} 個地區`);

  const chart = document.createElement('div');
  chart.className = 'space-y-2';
  sorted.forEach(([district, count]) => {
    const pct = (count / max) * 100;
    const isPreferred = prefDistricts.has(district);
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.innerHTML = `
      <span class="text-xs w-20 text-right ${isPreferred ? 'font-bold text-primary' : 'text-base-content/70'}">${district}</span>
      <div class="flex-1 bg-base-200 rounded-full h-4 overflow-hidden">
        <div class="h-full rounded-full transition-all ${isPreferred ? 'bg-primary' : 'bg-base-content/20'}" style="width: ${pct}%"></div>
      </div>
      <span class="text-xs w-6 ${isPreferred ? 'font-bold text-primary' : 'text-base-content/50'}">${count}</span>
    `;
    chart.appendChild(row);
  });

  card.appendChild(chart);
  container.appendChild(card);
}

function renderTuitionChart(container) {
  const allSchools = getAppState('allSchools');

  const ranges = { '免費 / 資助': 0, '<$30,000': 0, '$30,000-$60,000': 0, '>$60,000': 0 };
  const genderCounts = {};

  allSchools.forEach(s => {
    genderCounts[s.gender] = (genderCounts[s.gender] || 0) + 1;

    const t = s.tuition || '';
    const match = t.match(/\$?([\d,]+)/);
    if (!match || t === '-') {
      ranges['免費 / 資助']++;
    } else {
      const amount = parseInt(match[1].replace(/,/g, ''), 10);
      if (amount < 30000) ranges['<$30,000']++;
      else if (amount <= 60000) ranges['$30,000-$60,000']++;
      else ranges['>$60,000']++;
    }
  });

  const card = createCard('學費統計', '');

  const maxRange = Math.max(...Object.values(ranges));
  const rangeChart = document.createElement('div');
  rangeChart.className = 'space-y-2 mb-4';
  Object.entries(ranges).forEach(([label, count]) => {
    const pct = (count / maxRange) * 100;
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.innerHTML = `
      <span class="text-xs w-28 text-right text-base-content/70">${label}</span>
      <div class="flex-1 bg-base-200 rounded-full h-4 overflow-hidden">
        <div class="h-full bg-secondary/60 rounded-full" style="width: ${pct}%"></div>
      </div>
      <span class="text-xs w-6 text-base-content/50">${count}</span>
    `;
    rangeChart.appendChild(row);
  });
  card.appendChild(rangeChart);

  const genderDiv = document.createElement('div');
  genderDiv.className = 'flex gap-4 text-sm text-base-content/60 pt-2 border-t';
  Object.entries(genderCounts).forEach(([gender, count]) => {
    genderDiv.innerHTML += `<span>${gender}: ${count}</span>`;
  });
  card.appendChild(genderDiv);

  container.appendChild(card);
}

function createCard(title, subtitle) {
  const card = document.createElement('div');
  card.className = 'card bg-base-100 shadow-sm';
  const body = document.createElement('div');
  body.className = 'card-body p-4';
  body.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-bold text-base">${title}</h3>
      ${subtitle ? `<span class="text-xs text-base-content/50">${subtitle}</span>` : ''}
    </div>
  `;
  card.appendChild(body);
  return body;
}

function createPlaceholderCard(title, message, linkHash) {
  const card = document.createElement('div');
  card.className = 'card bg-base-100 shadow-sm';
  card.innerHTML = `
    <div class="card-body p-4 items-center text-center">
      <h3 class="font-bold text-base">${title}</h3>
      <p class="text-sm text-base-content/50 mt-2">${message}</p>
      <a href="${linkHash}" class="btn btn-sm btn-outline mt-2">前往設定</a>
    </div>
  `;
  return card;
}

function ratingBadgeInline(rating) {
  const classes = { Top: 'badge-success', High: 'badge-warning', Medium: 'badge-ghost' };
  return `<span class="badge ${classes[rating] || 'badge-ghost'} badge-sm">${rating}</span>`;
}
