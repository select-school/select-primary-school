import {
  getAppState, setAppState, ratingBadge, googleSearchUrl,
  showDetailModal, buildDistrictNetsMap,
  renderLinkedSecondaryCompact, renderAssessmentCompact
} from './shared.js';

let selectedForCompare = new Set();
let expandedRow = null;
let _syncingFilters = false;

function getCategoryGroup(school) {
  const cat = school.schoolCategory || '';
  return (cat === '資助' || cat === '官立') ? 'free' : 'paid';
}

export async function initRanking() {
  populateFilterOptions();
  bindFilterEvents();
  render();
}

export function refreshRanking() {
  render();
}

export function updateSchoolRating(schoolId) {
  const allSchools = getAppState('allSchools');
  const school = allSchools.find(s => s.id === schoolId);
  if (!school) return;
  const rating = school.userData?.rating || null;
  const badge = ratingBadge(rating);

  const tr = document.querySelector(`tr[data-school-id="${schoolId}"]`);
  if (tr) {
    const ratingTd = tr.querySelector('.rating-cell');
    if (ratingTd) ratingTd.innerHTML = badge;
  }

  const card = document.querySelector(`.school-card[data-school-id="${schoolId}"]`);
  if (card) {
    const ratingEl = card.querySelector('.rating-cell');
    if (ratingEl) ratingEl.innerHTML = badge;
  }
}

export function applyRankingFilters(overrides) {
  if (overrides.districts) {
    document.querySelectorAll('.district-check').forEach(cb => {
      cb.checked = overrides.districts.includes(cb.value);
    });
    updateDropdownLabel('district');
  }
  if (overrides.nets) {
    document.querySelectorAll('.net-check').forEach(cb => {
      cb.checked = overrides.nets.includes(Number(cb.value));
    });
    updateDropdownLabel('net');
  }
  if (overrides.gender) {
    const cb = document.querySelector(`.gender-check[value="${overrides.gender}"]`);
    if (cb) cb.checked = true;
  }
  render();
}

function populateFilterOptions() {
  const allSchools = getAppState('allSchools');
  const schoolNets = getAppState('schoolNets');
  const districtNetsMap = getAppState('districtNetsMap');

  const districts = [...new Set(allSchools.map(s => s.district))].sort();
  const districtContainer = document.getElementById('district-options');
  districtContainer.innerHTML = '';
  districts.forEach(d => {
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 p-1 cursor-pointer hover:bg-base-200 rounded';
    label.innerHTML = `<input type="checkbox" class="checkbox checkbox-sm district-check" value="${d}"><span class="text-sm">${d}</span>`;
    districtContainer.appendChild(label);
  });

  const nets = [...new Set(Object.keys(schoolNets).map(Number))].sort((a, b) => a - b);
  const netContainer = document.getElementById('net-options');
  netContainer.innerHTML = '';
  nets.forEach(n => {
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 p-1 cursor-pointer hover:bg-base-200 rounded';
    label.innerHTML = `<input type="checkbox" class="checkbox checkbox-sm net-check" value="${n}"><span class="text-sm">${n} (${schoolNets[String(n)]})</span>`;
    netContainer.appendChild(label);
  });

  districtContainer.addEventListener('change', (e) => {
    if (_syncingFilters) return;
    _syncingFilters = true;
    const netsForDistrict = districtNetsMap[e.target.value] || [];
    netsForDistrict.forEach(netNum => {
      const netCb = document.querySelector(`.net-check[value="${netNum}"]`);
      if (netCb) netCb.checked = e.target.checked;
    });
    updateDropdownLabel('district');
    updateDropdownLabel('net');
    _syncingFilters = false;
    render();
  });

  netContainer.addEventListener('change', (e) => {
    if (_syncingFilters) return;
    _syncingFilters = true;
    const changedNet = Number(e.target.value);
    const district = schoolNets[String(changedNet)];
    if (district) {
      const netsForDistrict = districtNetsMap[district] || [];
      const anyNetChecked = netsForDistrict.some(netNum => {
        const netCb = document.querySelector(`.net-check[value="${netNum}"]`);
        return netCb && netCb.checked;
      });
      const districtCb = document.querySelector(`.district-check[value="${district}"]`);
      if (districtCb) districtCb.checked = anyNetChecked;
    }
    updateDropdownLabel('district');
    updateDropdownLabel('net');
    _syncingFilters = false;
    render();
  });
}

function updateDropdownLabel(type) {
  if (type === 'district') {
    const checked = [...document.querySelectorAll('.district-check:checked')];
    document.getElementById('district-label').textContent =
      checked.length === 0 ? '全部地區' : `已選 ${checked.length} 個地區`;
  } else {
    const checked = [...document.querySelectorAll('.net-check:checked')];
    document.getElementById('net-label').textContent =
      checked.length === 0 ? '全部校網' : `已選 ${checked.length} 個校網`;
  }
}

function getFilters() {
  const search = document.getElementById('filter-search').value.trim().toLowerCase();
  const selectedDistricts = [...document.querySelectorAll('.district-check:checked')].map(cb => cb.value);
  const selectedNets = [...document.querySelectorAll('.net-check:checked')].map(cb => Number(cb.value)).filter(v => !isNaN(v));
  const selectedGenders = [...document.querySelectorAll('.gender-check:checked')].map(cb => cb.value);
  const selectedRatings = [...document.querySelectorAll('.rating-check:checked')].map(cb => cb.value);
  const selectedCategories = [...document.querySelectorAll('.category-check:checked')].map(cb => cb.value);
  return { search, selectedDistricts, selectedNets, selectedGenders, selectedRatings, selectedCategories };
}

function applyFilters() {
  const allSchools = getAppState('allSchools');
  const { search, selectedDistricts, selectedNets, selectedGenders, selectedRatings, selectedCategories } = getFilters();

  return allSchools.filter(school => {
    if (search && !school.name.toLowerCase().includes(search)) return false;
    if (selectedDistricts.length > 0 && !selectedDistricts.includes(school.district)) return false;
    if (selectedNets.length > 0) {
      const schoolNetNums = school.schoolNet || [];
      if (!selectedNets.some(n => schoolNetNums.includes(n))) return false;
    }
    if (selectedGenders.length > 0 && !selectedGenders.includes(school.gender)) return false;
    if (selectedCategories.length > 0 && !selectedCategories.includes(getCategoryGroup(school))) return false;
    if (selectedRatings.length > 0) {
      const schoolRating = school.userData?.rating || null;
      if (selectedRatings.includes('Unrated') && schoolRating === null) return true;
      if (schoolRating && selectedRatings.includes(schoolRating)) return true;
      if (!selectedRatings.includes('Unrated') && !schoolRating) return false;
      if (!selectedRatings.includes(schoolRating)) return false;
    }
    return true;
  });
}

let _searchTimer;
function bindFilterEvents() {
  document.getElementById('filter-search').addEventListener('input', () => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(render, 200);
  });
  document.querySelectorAll('.gender-check').forEach(cb => cb.addEventListener('change', render));
  document.querySelectorAll('.category-check').forEach(cb => cb.addEventListener('change', render));
  document.querySelectorAll('.rating-check').forEach(cb => cb.addEventListener('change', render));
  document.getElementById('sort-by').addEventListener('change', render);
  document.getElementById('clear-filters').addEventListener('click', clearFilters);
  document.getElementById('filter-toggle').addEventListener('click', toggleFilters);
  document.getElementById('compare-btn').addEventListener('click', showComparison);
  document.getElementById('compare-clear').addEventListener('click', clearCompare);
}

function toggleFilters() {
  const panel = document.getElementById('filter-panel');
  const btn = document.getElementById('filter-toggle');
  panel.classList.toggle('hidden');
  btn.textContent = panel.classList.contains('hidden') ? '篩選條件 ▼' : '篩選條件 ▲';
}

function clearFilters() {
  document.getElementById('filter-search').value = '';
  document.querySelectorAll('.district-check').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.net-check').forEach(cb => { cb.checked = false; });
  document.getElementById('district-label').textContent = '全部地區';
  document.getElementById('net-label').textContent = '全部校網';
  document.querySelectorAll('.gender-check').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.category-check').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.rating-check').forEach(cb => { cb.checked = false; });
  render();
}

function render() {
  const allSchools = getAppState('allSchools');
  const sortBy = document.getElementById('sort-by')?.value || 'rank';
  let filtered = applyFilters();

  if (sortBy === 'schoolNet') {
    filtered.sort((a, b) => {
      const aNet = (a.schoolNet || [])[0] || 999;
      const bNet = (b.schoolNet || [])[0] || 999;
      return aNet - bNet || a.rank - b.rank;
    });
  }

  const countEl = document.getElementById('school-count');
  if (countEl) countEl.textContent = `顯示 ${filtered.length} / ${allSchools.length} 所學校`;
  const mobileCountEl = document.getElementById('school-count-mobile');
  if (mobileCountEl) mobileCountEl.textContent = `${filtered.length} / ${allSchools.length}`;

  if (window.innerWidth >= 768) {
    renderTable(filtered);
  } else {
    renderCards(filtered);
  }
  updateCompareBar();
}

function renderTable(schools) {
  const tbody = document.getElementById('school-tbody');
  tbody.innerHTML = '';

  schools.forEach(school => {
    const isExpanded = expandedRow === school.id;
    const isSelected = selectedForCompare.has(school.id);
    const rating = school.userData?.rating || null;
    const nets = (school.schoolNet || []).join(', ');

    const tr = document.createElement('tr');
    tr.dataset.schoolId = school.id;
    tr.className = isSelected ? 'selected-for-compare cursor-pointer hover' : 'cursor-pointer hover';
    tr.innerHTML = `
      <td><input type="checkbox" class="checkbox checkbox-sm compare-check" data-id="${school.id}" ${isSelected ? 'checked' : ''}></td>
      <td class="font-mono">${school.rank}</td>
      <td class="font-medium">${school.name}</td>
      <td>${school.gender}</td>
      <td>${school.district}<br><span class="text-xs text-base-content/50">校網 ${nets}</span></td>
      <td class="rating-cell">${ratingBadge(rating)}</td>
      <td class="text-sm">${school.schoolCategory || '-'}</td>
      <td class="text-sm">${school.tuition}</td>
      <td>
        <a href="${googleSearchUrl(school.name)}" target="_blank" class="btn btn-ghost btn-xs" title="Google 搜尋" onclick="event.stopPropagation()">🔍</a>
      </td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.classList.contains('compare-check') || e.target.closest('a')) return;
      expandedRow = expandedRow === school.id ? null : school.id;
      render();
    });

    tr.querySelector('.compare-check').addEventListener('change', (e) => {
      e.stopPropagation();
      toggleCompare(school.id);
    });

    tbody.appendChild(tr);

    if (isExpanded) {
      const detailTr = document.createElement('tr');
      detailTr.innerHTML = `<td colspan="9" class="p-0"><div class="detail-panel p-4 bg-base-200/50">
        <button class="btn btn-sm btn-outline mb-2" onclick="event.stopPropagation()">查看詳情</button>
      </div></td>`;
      detailTr.querySelector('button').addEventListener('click', () => showDetailModal(school));
      tbody.appendChild(detailTr);
    }
  });
}

function renderCards(schools) {
  const container = document.getElementById('school-cards');
  container.innerHTML = '';

  schools.forEach(school => {
    const rating = school.userData?.rating || null;
    const nets = (school.schoolNet || []).join(', ');
    const isSelected = selectedForCompare.has(school.id);

    const card = document.createElement('div');
    card.className = `card bg-base-100 shadow-sm mb-3 school-card ${isSelected ? 'ring-2 ring-primary' : ''}`;
    card.dataset.schoolId = school.id;
    card.innerHTML = `
      <div class="card-body p-4">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2">
            <input type="checkbox" class="checkbox checkbox-sm compare-check" data-id="${school.id}" ${isSelected ? 'checked' : ''}>
            <span class="font-mono text-base-content/50">#${school.rank}</span>
          </div>
          <div class="flex gap-1">
            <span class="rating-cell">${ratingBadge(rating)}</span>
            <a href="${googleSearchUrl(school.name)}" target="_blank" class="btn btn-ghost btn-xs" onclick="event.stopPropagation()">🔍</a>
          </div>
        </div>
        <h3 class="font-bold text-base mt-1">${school.name}</h3>
        <div class="text-sm text-base-content/70">${school.gender} · ${school.district} · 校網 ${nets} · ${school.schoolCategory || '-'}</div>
        <div class="text-sm text-base-content/60">${school.tuition}</div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('compare-check') || e.target.closest('a')) return;
      showDetailModal(school);
    });

    card.querySelector('.compare-check').addEventListener('change', (e) => {
      e.stopPropagation();
      toggleCompare(school.id);
    });

    container.appendChild(card);
  });
}

function toggleCompare(id) {
  if (selectedForCompare.has(id)) {
    selectedForCompare.delete(id);
  } else if (selectedForCompare.size < 3) {
    selectedForCompare.add(id);
  }
  render();
}

function clearCompare() {
  selectedForCompare.clear();
  render();
}

function updateCompareBar() {
  const bar = document.getElementById('compare-bar');
  const count = document.getElementById('compare-count');
  const btn = document.getElementById('compare-btn');
  if (selectedForCompare.size > 0) {
    bar.classList.remove('hidden');
    count.textContent = `已選擇 ${selectedForCompare.size} 所學校`;
    btn.disabled = selectedForCompare.size < 2;
  } else {
    bar.classList.add('hidden');
  }
}

function showComparison() {
  const allSchools = getAppState('allSchools');
  const schools = allSchools.filter(s => selectedForCompare.has(s.id));
  const content = document.getElementById('compare-content');

  const fields = [
    ['排名', s => `#${s.rank}`],
    ['性別', s => s.gender],
    ['地區', s => s.district],
    ['校網', s => (s.schoolNet || []).join(', ')],
    ['類別', s => s.schoolCategory || '-'],
    ['學費', s => s.tuition],
    ['評級', s => ratingBadge(s.userData?.rating) || '-'],
    ['相關中學', s => renderLinkedSecondaryCompact(s.linkedSecondary)],
    ['佔地面積', s => s.campusArea || '-'],
    ['課室數目', s => s.classroomCount || '-'],
    ['多元學習評估', s => `<span class="text-xs">${renderAssessmentCompact(s.assessment)}</span>`],
    ['特別室', s => `<span class="text-xs">${s.specialRooms || '-'}</span>`],
    ['學校設施', s => `<span class="text-xs">${s.facilities?.otherFacilities || '-'}</span>`],
  ];

  let html = `<div class="overflow-x-auto"><table class="table table-sm w-full">`;
  html += `<thead><tr><th></th>${schools.map(s => `<th class="font-bold">${s.name}</th>`).join('')}</tr></thead>`;
  html += `<tbody>`;
  fields.forEach(([label, getter]) => {
    const values = schools.map(getter);
    html += `<tr><td class="font-medium whitespace-nowrap">${label}</td>${values.map(v => `<td>${v}</td>`).join('')}</tr>`;
  });
  html += `</tbody></table></div>`;

  content.innerHTML = html;
  document.getElementById('compare-modal').showModal();
}
