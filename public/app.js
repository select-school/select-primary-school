let allSchools = [];
let schoolNets = {};
let districtNetsMap = {}; // district → [netNumbers]
let selectedForCompare = new Set();
let expandedRow = null;
let _syncingFilters = false;

async function init() {
  try {
    const [schoolsRes, netsRes] = await Promise.all([
      fetch('/api/schools'),
      fetch('/api/school-nets'),
    ]);
    allSchools = await schoolsRes.json();
    schoolNets = await netsRes.json();
  } catch (err) {
    console.error('載入資料失敗:', err);
    return;
  }

  populateFilterOptions();
  bindFilterEvents();
  render();
}

function populateFilterOptions() {
  const districts = [...new Set(allSchools.map(s => s.district))].sort();
  const districtContainer = document.getElementById('district-options');
  districts.forEach(d => {
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 p-1 cursor-pointer hover:bg-base-200 rounded';
    label.innerHTML = `<input type="checkbox" class="checkbox checkbox-sm district-check" value="${d}"><span class="text-sm">${d}</span>`;
    districtContainer.appendChild(label);
  });

  // Build reverse map: district → [netNumbers]
  Object.entries(schoolNets).forEach(([net, district]) => {
    if (!districtNetsMap[district]) districtNetsMap[district] = [];
    districtNetsMap[district].push(Number(net));
  });

  const nets = [...new Set(Object.keys(schoolNets).map(Number))].sort((a, b) => a - b);
  const netContainer = document.getElementById('net-options');
  nets.forEach(n => {
    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 p-1 cursor-pointer hover:bg-base-200 rounded';
    label.innerHTML = `<input type="checkbox" class="checkbox checkbox-sm net-check" value="${n}"><span class="text-sm">${n} (${schoolNets[String(n)]})</span>`;
    netContainer.appendChild(label);
  });

  // Bidirectional district ↔ net linking
  districtContainer.addEventListener('change', (e) => {
    if (_syncingFilters) return;
    _syncingFilters = true;
    const changedDistrict = e.target.value;
    const isChecked = e.target.checked;
    const netsForDistrict = districtNetsMap[changedDistrict] || [];
    netsForDistrict.forEach(netNum => {
      const netCb = document.querySelector(`.net-check[value="${netNum}"]`);
      if (netCb) netCb.checked = isChecked;
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
  const selectedDistricts = [...document.querySelectorAll('.district-check:checked')]
    .map(cb => cb.value);
  const selectedNets = [...document.querySelectorAll('.net-check:checked')]
    .map(cb => Number(cb.value))
    .filter(v => !isNaN(v));
  const gender = document.querySelector('input[name="gender"]:checked')?.value || '';
  const rating = document.querySelector('input[name="rating"]:checked')?.value || '';
  return { search, selectedDistricts, selectedNets, gender, rating };
}

function applyFilters() {
  const { search, selectedDistricts, selectedNets, gender, rating } = getFilters();

  return allSchools.filter(school => {
    if (search && !school.name.toLowerCase().includes(search)) return false;

    if (selectedDistricts.length > 0 && !selectedDistricts.includes(school.district)) return false;

    if (selectedNets.length > 0) {
      const schoolNetNums = school.schoolNet || [];
      if (!selectedNets.some(n => schoolNetNums.includes(n))) return false;
    }

    if (gender && school.gender !== gender) return false;

    if (rating) {
      const schoolRating = school.userData?.rating || null;
      if (rating === 'Unrated' && schoolRating !== null) return false;
      if (rating !== 'Unrated' && schoolRating !== rating) return false;
    }

    return true;
  });
}

function bindFilterEvents() {
  document.getElementById('filter-search').addEventListener('input', render);
  // District and net filter change events are bound in populateFilterOptions
  document.querySelectorAll('input[name="gender"]').forEach(r => r.addEventListener('change', render));
  document.querySelectorAll('input[name="rating"]').forEach(r => r.addEventListener('change', render));
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
  document.querySelector('input[name="gender"][value=""]').checked = true;
  document.querySelector('input[name="rating"][value=""]').checked = true;
  render();
}

function ratingBadge(rating) {
  if (!rating) return '';
  const classes = {
    Top: 'badge-success',
    High: 'badge-warning',
    Medium: 'badge-ghost',
  };
  return `<span class="badge ${classes[rating] || 'badge-ghost'} badge-sm">${rating}</span>`;
}

function googleSearchUrl(name) {
  return `https://www.google.com/search?q=${encodeURIComponent(name + ' 評價')}`;
}

function render() {
  const filtered = applyFilters();
  document.getElementById('school-count').textContent = `顯示 ${filtered.length} / ${allSchools.length} 所學校`;
  renderTable(filtered);
  renderCards(filtered);
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
    tr.className = isSelected ? 'selected-for-compare cursor-pointer hover' : 'cursor-pointer hover';
    tr.innerHTML = `
      <td><input type="checkbox" class="checkbox checkbox-sm compare-check" data-id="${school.id}" ${isSelected ? 'checked' : ''}></td>
      <td class="font-mono">${school.rank}</td>
      <td class="font-medium">${school.name}</td>
      <td>${school.gender}</td>
      <td>${school.district}<br><span class="text-xs text-base-content/50">校網 ${nets}</span></td>
      <td>${ratingBadge(rating)}</td>
      <td class="text-sm">${school.tuition}</td>
      <td>
        <a href="${googleSearchUrl(school.name)}" target="_blank" class="btn btn-ghost btn-xs" title="Google 搜尋" onclick="event.stopPropagation()">🔍</a>
      </td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.classList.contains('compare-check') || e.target.closest('a')) return;
      toggleExpand(school.id);
    });

    const checkbox = tr.querySelector('.compare-check');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      toggleCompare(school.id);
    });

    tbody.appendChild(tr);

    if (isExpanded) {
      const detailTr = document.createElement('tr');
      detailTr.innerHTML = `<td colspan="8" class="p-0"><div class="detail-panel">${renderDetailPanel(school)}</div></td>`;
      setDetailPanelValues(detailTr, school);
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
    card.innerHTML = `
      <div class="card-body p-4">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-2">
            <input type="checkbox" class="checkbox checkbox-sm compare-check" data-id="${school.id}" ${isSelected ? 'checked' : ''}>
            <span class="font-mono text-base-content/50">#${school.rank}</span>
          </div>
          <div class="flex gap-1">
            ${ratingBadge(rating)}
            <a href="${googleSearchUrl(school.name)}" target="_blank" class="btn btn-ghost btn-xs" onclick="event.stopPropagation()">🔍</a>
          </div>
        </div>
        <h3 class="font-bold text-base mt-1">${school.name}</h3>
        <div class="text-sm text-base-content/70">
          ${school.gender} · ${school.district} · 校網 ${nets}
        </div>
        <div class="text-sm text-base-content/60">${school.tuition}</div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('compare-check') || e.target.closest('a')) return;
      showDetailModal(school);
    });

    const checkbox = card.querySelector('.compare-check');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      toggleCompare(school.id);
    });

    container.appendChild(card);
  });
}

function renderDetailPanel(school) {
  const ud = school.userData || {};
  const hketUrl = `https://www.google.com/search?q=site:topschool.hket.com+${encodeURIComponent(school.name)}`;
  return `
    <div class="p-4 bg-base-200/50 space-y-4">
      <div class="flex gap-2 mb-2">
        <a href="${googleSearchUrl(school.name)}" target="_blank" class="btn btn-ghost btn-xs" onclick="event.stopPropagation()">🔍 Google 搜尋</a>
        <a href="${hketUrl}" target="_blank" class="btn btn-ghost btn-xs" onclick="event.stopPropagation()">📰 HKET 詳情</a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 class="font-bold text-sm mb-2">學校資料</h4>
          <div class="text-sm space-y-1">
            <p><span class="font-medium">多元學習評估：</span>${school.assessment || '-'}</p>
            <p><span class="font-medium">相關中學：</span>${school.relatedSecondary || '-'}</p>
            <p><span class="font-medium">佔地面積：</span>${school.campusArea || '-'}</p>
            <p><span class="font-medium">課室數目：</span>${school.classroomCount || '-'}</p>
            <p><span class="font-medium">特別室：</span>${school.specialRooms || '-'}</p>
            <p><span class="font-medium">學校設施：</span>${school.facilities || '-'}</p>
          </div>
        </div>
        <div>
          <h4 class="font-bold text-sm mb-2">我的評級</h4>
          <div class="flex gap-2 mb-2">
            <button class="btn btn-sm rating-btn ${ud.rating === 'Top' ? 'btn-success active' : 'btn-outline'}" onclick="setRating('${school.id}', 'Top')">Top</button>
            <button class="btn btn-sm rating-btn ${ud.rating === 'High' ? 'btn-warning active' : 'btn-outline'}" onclick="setRating('${school.id}', 'High')">High</button>
            <button class="btn btn-sm rating-btn ${ud.rating === 'Medium' ? 'btn-ghost active' : 'btn-outline'}" onclick="setRating('${school.id}', 'Medium')">Medium</button>
            <button class="btn btn-sm btn-outline" onclick="setRating('${school.id}', null)">清除</button>
          </div>
          <textarea class="textarea textarea-bordered w-full text-sm mb-1" rows="2" placeholder="評級原因..."
            id="reason-${school.id}" onchange="saveRating('${school.id}')"></textarea>

          <h4 class="font-bold text-sm mb-2 mt-3">備註</h4>
          <textarea class="textarea textarea-bordered w-full text-sm" rows="3" placeholder="添加備註..."
            id="notes-${school.id}"></textarea>
          <button class="btn btn-sm btn-primary mt-1" onclick="saveNotes('${school.id}', this)">儲存備註</button>
        </div>
      </div>
    </div>
  `;
}

function setDetailPanelValues(container, school) {
  const ud = school.userData || {};
  const reasonEl = container.querySelector(`#reason-${school.id}`);
  if (reasonEl) reasonEl.value = ud.ratingReason || '';
  const notesEl = container.querySelector(`#notes-${school.id}`);
  if (notesEl) notesEl.value = ud.notes || '';
}

function toggleExpand(id) {
  expandedRow = expandedRow === id ? null : id;
  render();
}

function showDetailModal(school) {
  const content = document.getElementById('detail-modal-content');
  content.innerHTML = `
    <h3 class="text-lg font-bold mb-1">${school.name}</h3>
    <p class="text-sm text-base-content/60 mb-4">#${school.rank} · ${school.gender} · ${school.district}</p>
    ${renderDetailPanel(school)}
  `;
  setDetailPanelValues(content, school);
  document.getElementById('detail-modal').showModal();
}

async function setRating(id, rating) {
  const reason = document.getElementById(`reason-${id}`)?.value || '';
  try {
    await fetch(`/api/schools/${id}/ranking`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, ratingReason: reason }),
    });
  } catch (err) {
    console.error('儲存評級失敗:', err);
    return;
  }
  const school = allSchools.find(s => s.id === id);
  if (school) {
    if (!school.userData) school.userData = {};
    school.userData.rating = rating;
    school.userData.ratingReason = reason;
  }
  render();
}

async function saveRating(id) {
  const school = allSchools.find(s => s.id === id);
  const rating = school?.userData?.rating || null;
  const reason = document.getElementById(`reason-${id}`)?.value || '';
  try {
    await fetch(`/api/schools/${id}/ranking`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, ratingReason: reason }),
    });
  } catch (err) {
    console.error('儲存評級失敗:', err);
    return;
  }
  if (school) {
    if (!school.userData) school.userData = {};
    school.userData.ratingReason = reason;
  }
}

async function saveNotes(id, btn) {
  const notes = document.getElementById(`notes-${id}`)?.value || '';
  try {
    await fetch(`/api/schools/${id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
  } catch (err) {
    console.error('儲存備註失敗:', err);
    return;
  }
  const school = allSchools.find(s => s.id === id);
  if (school) {
    if (!school.userData) school.userData = {};
    school.userData.notes = notes;
  }
  if (btn) {
    btn.textContent = '已儲存 ✓';
    setTimeout(() => btn.textContent = '儲存備註', 1500);
  }
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
  const schools = allSchools.filter(s => selectedForCompare.has(s.id));
  const content = document.getElementById('compare-content');

  const fields = [
    ['排名', s => `#${s.rank}`],
    ['性別', s => s.gender],
    ['地區', s => s.district],
    ['校網', s => (s.schoolNet || []).join(', ')],
    ['學費', s => s.tuition],
    ['評級', s => ratingBadge(s.userData?.rating) || '-'],
    ['相關中學', s => s.relatedSecondary || '-'],
    ['佔地面積', s => s.campusArea || '-'],
    ['課室數目', s => s.classroomCount || '-'],
    ['多元學習評估', s => `<span class="text-xs">${s.assessment || '-'}</span>`],
    ['特別室', s => `<span class="text-xs">${s.specialRooms || '-'}</span>`],
    ['學校設施', s => `<span class="text-xs">${s.facilities || '-'}</span>`],
  ];

  // Desktop: side-by-side table
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

init();
