const state = {
  allSchools: [],
  schoolNets: {},
  districtNetsMap: {},
  userData: {},
  preferences: {},
  session: null,
};

export function setAppState(key, value) { state[key] = value; }
export function getAppState(key) { return state[key]; }

export function getAuthHeaders() {
  if (state.session?.access_token) {
    return { 'Authorization': `Bearer ${state.session.access_token}` };
  }
  return {};
}

export async function fetchSchools() {
  const res = await fetch('/api/schools');
  return res.json();
}

export async function fetchSchoolNets() {
  const res = await fetch('/api/school-nets');
  return res.json();
}

export async function fetchUserData() {
  const res = await fetch('/api/user-data', { headers: getAuthHeaders() });
  return res.json();
}

export async function saveRating(id, rating, ratingReason) {
  await fetch('/api/user-data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ id, rating, ratingReason }),
  });
}

export async function saveNotes(id, notes) {
  await fetch('/api/user-data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ id, notes }),
  });
}

export async function savePreferences(prefs) {
  await fetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(prefs),
  });
}

export function ratingBadge(rating) {
  if (!rating) return '';
  const classes = { Top: 'badge-success', High: 'badge-warning', Medium: 'badge-ghost' };
  return `<span class="badge ${classes[rating] || 'badge-ghost'} badge-sm">${rating}</span>`;
}

export function googleSearchUrl(name) {
  return `https://www.google.com/search?q=${encodeURIComponent(name + ' 評價')}`;
}

export function buildDistrictNetsMap(schoolNets) {
  const map = {};
  Object.entries(schoolNets).forEach(([net, district]) => {
    if (!map[district]) map[district] = [];
    map[district].push(Number(net));
  });
  return map;
}

export function showDetailModal(school) {
  const content = document.getElementById('detail-modal-content');
  const ud = school.userData || {};
  const hketUrl = `https://www.google.com/search?q=site:topschool.hket.com+${encodeURIComponent(school.name)}`;
  const nets = (school.schoolNet || []).join(', ');

  let html = `
    <h3 class="text-lg font-bold">${school.name}</h3>
    ${school.nameEn ? `<p class="text-sm text-base-content/50">${school.nameEn}</p>` : ''}
    <p class="text-sm text-base-content/60 mb-4">#${school.rank} · ${school.gender} · ${school.district} · 校網 ${nets}</p>
    <div class="flex gap-2 mb-4">
      <a href="${googleSearchUrl(school.name)}" target="_blank" class="btn btn-ghost btn-xs">🔍 Google 搜尋</a>
      <a href="${hketUrl}" target="_blank" class="btn btn-ghost btn-xs">📰 HKET 詳情</a>
    </div>
  `;

  // Basic fields (all schools)
  html += `<div class="space-y-4">`;
  html += `<div>
    <h4 class="font-bold text-sm mb-2">學校資料</h4>
    <div class="text-sm space-y-1">
      <p><span class="font-medium">學費：</span>${school.tuition || '-'}</p>
      <p><span class="font-medium">多元學習評估：</span>${school.assessment || '-'}</p>
      <p><span class="font-medium">相關中學：</span>${school.relatedSecondary || '-'}</p>
      <p><span class="font-medium">佔地面積：</span>${school.campusArea || '-'}</p>
      <p><span class="font-medium">課室數目：</span>${school.classroomCount || '-'}</p>
      <p><span class="font-medium">特別室：</span>${school.specialRooms || '-'}</p>
      <p><span class="font-medium">學校設施：</span>${typeof school.facilities === 'string' ? school.facilities : (school.facilities?.otherFacilities || '-')}</p>
    </div>
  </div>`;

  // Extended: school info
  if (school.address || school.phone || school.website) {
    html += `<div>
      <h4 class="font-bold text-sm mb-2">聯絡資訊</h4>
      <div class="text-sm space-y-1">
        ${school.address ? `<p><span class="font-medium">地址：</span>${school.address}</p>` : ''}
        ${school.phone ? `<p><span class="font-medium">電話：</span>${school.phone}</p>` : ''}
        ${school.fax ? `<p><span class="font-medium">傳真：</span>${school.fax}</p>` : ''}
        ${school.email ? `<p><span class="font-medium">電郵：</span>${school.email}</p>` : ''}
        ${school.website ? `<p><span class="font-medium">網站：</span><a href="${school.website}" target="_blank" class="link link-primary">${school.website}</a></p>` : ''}
      </div>
    </div>`;
  }

  // Extended: basic info
  if (school.principal || school.foundingYear || school.religion) {
    html += `<div>
      <h4 class="font-bold text-sm mb-2">學校背景</h4>
      <div class="text-sm space-y-1">
        ${school.principal ? `<p><span class="font-medium">校長：</span>${school.principal}</p>` : ''}
        ${school.schoolCategory ? `<p><span class="font-medium">學校類別：</span>${school.schoolCategory}</p>` : ''}
        ${school.religion ? `<p><span class="font-medium">宗教：</span>${school.religion}</p>` : ''}
        ${school.sponsoringBody ? `<p><span class="font-medium">辦學團體：</span>${school.sponsoringBody}</p>` : ''}
        ${school.motto ? `<p><span class="font-medium">校訓：</span>${school.motto}</p>` : ''}
        ${school.foundingYear ? `<p><span class="font-medium">創校年份：</span>${school.foundingYear}</p>` : ''}
        ${school.teachingLanguage ? `<p><span class="font-medium">教學語言：</span>${school.teachingLanguage}</p>` : ''}
        ${school.schoolBusService ? `<p><span class="font-medium">校車服務：</span>${school.schoolBusService}</p>` : ''}
      </div>
    </div>`;
  }

  // Extended: teachers
  if (school.teachers) {
    const t = school.teachers;
    html += `<div>
      <h4 class="font-bold text-sm mb-2">教師資料</h4>
      <div class="text-sm space-y-1">
        ${t.totalCount ? `<p><span class="font-medium">教師人數：</span>${t.totalCount}</p>` : ''}
        ${t.trainedPct != null ? `<p><span class="font-medium">已受訓：</span>${t.trainedPct}%</p>` : ''}
        ${t.bachelorPct != null ? `<p><span class="font-medium">學士或以上：</span>${t.bachelorPct}%</p>` : ''}
        ${t.masterPlusPct != null ? `<p><span class="font-medium">碩士或以上：</span>${t.masterPlusPct}%</p>` : ''}
        ${t.specialEdPct != null ? `<p><span class="font-medium">特殊教育培訓：</span>${t.specialEdPct}%</p>` : ''}
        ${t.exp0to4Pct != null ? `<p><span class="font-medium">0-4年經驗：</span>${t.exp0to4Pct}%</p>` : ''}
        ${t.exp5to9Pct != null ? `<p><span class="font-medium">5-9年經驗：</span>${t.exp5to9Pct}%</p>` : ''}
        ${t.exp10plusPct != null ? `<p><span class="font-medium">10年以上經驗：</span>${t.exp10plusPct}%</p>` : ''}
      </div>
    </div>`;
  }

  // Extended: class structure
  if (school.classStructure?.current) {
    const c = school.classStructure.current;
    html += `<div>
      <h4 class="font-bold text-sm mb-2">班級結構</h4>
      <div class="text-sm">
        <p>小一: ${c.p1 ?? '-'} | 小二: ${c.p2 ?? '-'} | 小三: ${c.p3 ?? '-'} | 小四: ${c.p4 ?? '-'} | 小五: ${c.p5 ?? '-'} | 小六: ${c.p6 ?? '-'} | 合共: ${c.total ?? '-'}</p>
      </div>
    </div>`;
  }

  // Extended: fees
  if (school.fees) {
    const f = school.fees;
    html += `<div>
      <h4 class="font-bold text-sm mb-2">費用詳情</h4>
      <div class="text-sm space-y-1">
        ${f.tuition != null ? `<p><span class="font-medium">學費：</span>$${f.tuition.toLocaleString()}</p>` : ''}
        ${f.ptaFees != null ? `<p><span class="font-medium">家教會費：</span>$${f.ptaFees}</p>` : ''}
        ${f.nonStandardFeesDesc ? `<p><span class="font-medium">非標準項目：</span>${f.nonStandardFeesDesc}</p>` : ''}
        ${f.otherFeesDesc ? `<p><span class="font-medium">其他費用：</span>${f.otherFeesDesc}</p>` : ''}
      </div>
    </div>`;
  }

  // Extended: school life
  if (school.schoolLife) {
    const sl = school.schoolLife;
    html += `<div>
      <h4 class="font-bold text-sm mb-2">學校生活</h4>
      <div class="text-sm space-y-1">
        ${sl.daysPerWeek ? `<p><span class="font-medium">每週上課：</span>${sl.daysPerWeek}天</p>` : ''}
        ${sl.startTime && sl.endTime ? `<p><span class="font-medium">上課時間：</span>${sl.startTime} - ${sl.endTime}</p>` : ''}
        ${sl.lessonsPerDay ? `<p><span class="font-medium">每天課節：</span>${sl.lessonsPerDay}節 (${sl.lessonDuration || ''})</p>` : ''}
        ${sl.lunchArrangement ? `<p><span class="font-medium">午膳安排：</span>${sl.lunchArrangement}</p>` : ''}
      </div>
    </div>`;
  }

  // Extended: ECAs
  if (school.ecas) {
    html += `<div>
      <h4 class="font-bold text-sm mb-2">課外活動</h4>
      <p class="text-sm">${school.ecas}</p>
    </div>`;
  }

  // Extended: mission & development
  if (school.mission || school.schoolEthos) {
    html += `<div>
      <h4 class="font-bold text-sm mb-2">學校發展</h4>
      <div class="text-sm space-y-1">
        ${school.mission ? `<p><span class="font-medium">辦學宗旨：</span>${school.mission}</p>` : ''}
        ${school.schoolEthos ? `<p><span class="font-medium">學校特色：</span>${school.schoolEthos}</p>` : ''}
      </div>
    </div>`;
  }

  // Extended: parent cooperation
  if (school.parentCooperation) {
    html += `<div>
      <h4 class="font-bold text-sm mb-2">家校合作</h4>
      <p class="text-sm">${school.parentCooperation}</p>
    </div>`;
  }

  // Extended: SEN facilities
  if (school.facilities?.senFacilities) {
    html += `<div>
      <h4 class="font-bold text-sm mb-2">無障礙設施</h4>
      <p class="text-sm">${school.facilities.senFacilities}</p>
    </div>`;
  }

  // Rating & Notes (always shown)
  html += `<div class="divider"></div>`;
  html += `<div>
    <h4 class="font-bold text-sm mb-2">我的評級</h4>
    <div class="flex gap-2 mb-2">
      <button class="btn btn-sm rating-btn ${ud.rating === 'Top' ? 'btn-success active' : 'btn-outline'}" onclick="window.__setRating('${school.id}', 'Top')">Top</button>
      <button class="btn btn-sm rating-btn ${ud.rating === 'High' ? 'btn-warning active' : 'btn-outline'}" onclick="window.__setRating('${school.id}', 'High')">High</button>
      <button class="btn btn-sm rating-btn ${ud.rating === 'Medium' ? 'btn-ghost active' : 'btn-outline'}" onclick="window.__setRating('${school.id}', 'Medium')">Medium</button>
      <button class="btn btn-sm btn-outline" onclick="window.__setRating('${school.id}', null)">清除</button>
    </div>
    <textarea class="textarea textarea-bordered w-full text-sm mb-1" rows="2" placeholder="評級原因..."
      id="reason-${school.id}">${ud.ratingReason || ''}</textarea>

    <h4 class="font-bold text-sm mb-2 mt-3">備註</h4>
    <textarea class="textarea textarea-bordered w-full text-sm" rows="3" placeholder="添加備註..."
      id="notes-${school.id}">${ud.notes || ''}</textarea>
    <button class="btn btn-sm btn-primary mt-1" onclick="window.__saveNotes('${school.id}', this)">儲存備註</button>
  </div>`;

  html += `</div>`;
  content.innerHTML = html;
  document.getElementById('detail-modal').showModal();
}

window.__setRating = async function(id, rating) {
  const reason = document.getElementById(`reason-${id}`)?.value || '';
  await saveRating(id, rating, reason);
  const school = state.allSchools.find(s => s.id === id);
  if (school) {
    if (!school.userData) school.userData = {};
    school.userData.rating = rating;
    school.userData.ratingReason = reason;
  }
  showDetailModal(school);
  if (window.__onDataChange) window.__onDataChange();
};

window.__saveNotes = async function(id, btn) {
  const notes = document.getElementById(`notes-${id}`)?.value || '';
  await saveNotes(id, notes);
  const school = state.allSchools.find(s => s.id === id);
  if (school) {
    if (!school.userData) school.userData = {};
    school.userData.notes = notes;
  }
  if (btn) {
    btn.textContent = '已儲存 ✓';
    setTimeout(() => btn.textContent = '儲存備註', 1500);
  }
};
