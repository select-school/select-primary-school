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

function collapseSection(title, contentHtml) {
  if (!contentHtml) return '';
  return `
    <div class="collapse collapse-arrow bg-base-200 rounded-box mb-2">
      <input type="checkbox" />
      <div class="collapse-title font-medium text-sm py-3 min-h-0">${title}</div>
      <div class="collapse-content text-sm">${contentHtml}</div>
    </div>`;
}

export function renderLinkedSecondaryCompact(linkedSecondary) {
  if (!linkedSecondary?.length) return '-';
  const typeColors = { '一條龍': 'badge-primary', '直屬': 'badge-secondary', '聯繫': 'badge-ghost' };
  return linkedSecondary.map(ls =>
    `${ls.name} <span class="badge badge-xs ${typeColors[ls.type] || 'badge-ghost'}">${ls.type}</span>`
  ).join('、');
}

export function renderAssessmentCompact(assessment) {
  if (!assessment) return '-';
  const a = assessment;
  return `小一: ${a.p1Tests}測${a.p1Exams}考 | 小二至六: ${a.p2to6Tests}測${a.p2to6Exams}考`;
}

export function showDetailModal(school) {
  const content = document.getElementById('detail-modal-content');
  const ud = school.userData || {};
  const hketUrl = `https://www.google.com/search?q=site:topschool.hket.com+${encodeURIComponent(school.name)}`;
  const nets = (school.schoolNet || []).join(', ');
  const sl = school.schoolLife || {};
  const schoolHours = (sl.startTime && sl.endTime) ? `${sl.startTime} - ${sl.endTime}` : '-';

  // === HEADER ===
  let html = `
    <h3 class="text-lg font-bold">${school.name}</h3>
    ${school.nameEn ? `<p class="text-sm text-base-content/50">${school.nameEn}</p>` : ''}
    <p class="text-sm text-base-content/60 mb-3">
      #${school.rank} · ${school.gender} · ${school.district} · 校網 ${nets}
      ${ratingBadge(ud.rating)}
    </p>
  `;

  // === SUMMARY CARD ===
  html += `
    <div class="grid grid-cols-2 gap-x-4 gap-y-2 bg-base-200 rounded-box p-4 mb-4">
      <div>
        <div class="text-xs text-base-content/50">相關中學</div>
        <div class="text-sm font-medium">${renderLinkedSecondaryCompact(school.linkedSecondary)}</div>
      </div>
      <div>
        <div class="text-xs text-base-content/50">學費</div>
        <div class="text-sm font-medium">${school.tuition || '-'}</div>
      </div>
      <div>
        <div class="text-xs text-base-content/50">上課時間</div>
        <div class="text-sm font-medium">${schoolHours}</div>
      </div>
      <div>
        <div class="text-xs text-base-content/50">教學語言</div>
        <div class="text-sm font-medium">${school.teachingLanguage || '-'}</div>
      </div>
      <div>
        <div class="text-xs text-base-content/50">宗教</div>
        <div class="text-sm font-medium">${school.religion || '-'}</div>
      </div>
      <div>
        <div class="text-xs text-base-content/50">佔地面積</div>
        <div class="text-sm font-medium">${school.campusArea || '-'}</div>
      </div>
    </div>
  `;

  // === QUICK LINKS ===
  html += `
    <div class="flex flex-wrap gap-2 mb-4">
      <a href="${googleSearchUrl(school.name)}" target="_blank" class="btn btn-ghost btn-xs">🔍 Google 搜尋</a>
      <a href="${hketUrl}" target="_blank" class="btn btn-ghost btn-xs">📰 HKET 詳情</a>
      ${school.website ? `<a href="${school.website}" target="_blank" class="btn btn-ghost btn-xs">🌐 學校網站</a>` : ''}
    </div>
  `;

  // === COLLAPSIBLE SECTIONS ===
  html += `<div class="space-y-2">`;

  // Section 1: Fees & School Life
  const f = school.fees || {};
  let feesLifeHtml = `<div class="space-y-1 mb-3">`;
  feesLifeHtml += `<h5 class="font-medium text-xs text-base-content/50 uppercase mb-1">費用</h5>`;
  feesLifeHtml += `<p><span class="font-medium">學費：</span>${f.tuition != null ? `$${f.tuition.toLocaleString()}` : (school.tuition || '-')}</p>`;
  if (f.hallFees != null) feesLifeHtml += `<p><span class="font-medium">堂費：</span>$${f.hallFees.toLocaleString()}</p>`;
  if (f.ptaFees != null) feesLifeHtml += `<p><span class="font-medium">家教會費：</span>$${f.ptaFees}</p>`;
  if (f.nonStandardFeesDesc) feesLifeHtml += `<p><span class="font-medium">非標準項目：</span>${f.nonStandardFeesDesc}</p>`;
  if (f.otherFeesDesc) feesLifeHtml += `<p><span class="font-medium">其他費用：</span>${f.otherFeesDesc}</p>`;
  feesLifeHtml += `</div>`;
  if (sl.startTime) {
    feesLifeHtml += `<div class="space-y-1">`;
    feesLifeHtml += `<h5 class="font-medium text-xs text-base-content/50 uppercase mb-1">學校生活</h5>`;
    if (sl.daysPerWeek) feesLifeHtml += `<p><span class="font-medium">每週上課：</span>${sl.daysPerWeek}天</p>`;
    if (sl.startTime && sl.endTime) feesLifeHtml += `<p><span class="font-medium">上課時間：</span>${sl.startTime} - ${sl.endTime}</p>`;
    if (sl.lessonsPerDay) feesLifeHtml += `<p><span class="font-medium">每天課節：</span>${sl.lessonsPerDay}節 (${sl.lessonDuration || ''})</p>`;
    if (sl.lunchTime) feesLifeHtml += `<p><span class="font-medium">午膳時間：</span>${sl.lunchTime}</p>`;
    if (sl.lunchArrangement) feesLifeHtml += `<p><span class="font-medium">午膳安排：</span>${sl.lunchArrangement}</p>`;
    feesLifeHtml += `</div>`;
  }
  html += collapseSection('費用及學校生活', feesLifeHtml);

  // Section 2: Assessment & Secondary Pathway
  const a = school.assessment || {};
  const ls = school.linkedSecondary || [];
  let assessHtml = `<div class="space-y-1 mb-3">`;
  assessHtml += `<h5 class="font-medium text-xs text-base-content/50 uppercase mb-1">評估</h5>`;
  assessHtml += `<p><span class="font-medium">小一：</span>${a.p1Tests ?? '-'}次測驗、${a.p1Exams ?? '-'}次考試</p>`;
  assessHtml += `<p><span class="font-medium">小二至小六：</span>${a.p2to6Tests ?? '-'}次測驗、${a.p2to6Exams ?? '-'}次考試</p>`;
  if (a.noExamBeforeHoliday != null) assessHtml += `<p><span class="font-medium">假期前不設考試：</span>${a.noExamBeforeHoliday ? '是' : '否'}</p>`;
  if (a.classStreaming) assessHtml += `<p><span class="font-medium">分班安排：</span>${a.classStreaming}</p>`;
  if (a.multiAssessment) assessHtml += `<p><span class="font-medium">多元學習評估：</span>${a.multiAssessment}</p>`;
  assessHtml += `</div>`;
  assessHtml += `<div class="space-y-1">`;
  assessHtml += `<h5 class="font-medium text-xs text-base-content/50 uppercase mb-1">相關中學</h5>`;
  const typeColors = { '一條龍': 'badge-primary', '直屬': 'badge-secondary', '聯繫': 'badge-ghost' };
  if (ls.length) {
    assessHtml += ls.map(l =>
      `<p><span class="badge badge-sm ${typeColors[l.type] || 'badge-ghost'}">${l.type}</span> ${l.name}</p>`
    ).join('');
  } else {
    assessHtml += `<p>沒有相關中學</p>`;
  }
  assessHtml += `</div>`;
  html += collapseSection('評估及升中', assessHtml);

  // Section 3: School Background
  let bgHtml = `<div class="space-y-1">`;
  if (school.principal) bgHtml += `<p><span class="font-medium">校長：</span>${school.principal}</p>`;
  if (school.schoolCategory) bgHtml += `<p><span class="font-medium">學校類別：</span>${school.schoolCategory}</p>`;
  if (school.religion) bgHtml += `<p><span class="font-medium">宗教：</span>${school.religion}</p>`;
  if (school.sponsoringBody) bgHtml += `<p><span class="font-medium">辦學團體：</span>${school.sponsoringBody}</p>`;
  if (school.motto) bgHtml += `<p><span class="font-medium">校訓：</span>${school.motto}</p>`;
  if (school.foundingYear) bgHtml += `<p><span class="font-medium">創校年份：</span>${school.foundingYear}</p>`;
  if (school.teachingLanguage) bgHtml += `<p><span class="font-medium">教學語言：</span>${school.teachingLanguage}</p>`;
  if (school.schoolBusService) bgHtml += `<p><span class="font-medium">校車服務：</span>${school.schoolBusService}</p>`;
  bgHtml += `</div>`;
  html += collapseSection('學校背景', bgHtml);

  // Section 4: Teachers & Classes
  let tcHtml = '';
  if (school.teachers) {
    const t = school.teachers;
    tcHtml += `<div class="space-y-1 mb-3">`;
    tcHtml += `<h5 class="font-medium text-xs text-base-content/50 uppercase mb-1">教師</h5>`;
    if (t.totalCount) tcHtml += `<p><span class="font-medium">教師人數：</span>${t.totalCount}</p>`;
    if (t.bachelorPct != null) tcHtml += `<p><span class="font-medium">學士或以上：</span>${t.bachelorPct}%</p>`;
    if (t.masterPlusPct != null) tcHtml += `<p><span class="font-medium">碩士或以上：</span>${t.masterPlusPct}%</p>`;
    if (t.trainedPct != null) tcHtml += `<p><span class="font-medium">已受訓：</span>${t.trainedPct}%</p>`;
    if (t.specialEdPct != null) tcHtml += `<p><span class="font-medium">特殊教育培訓：</span>${t.specialEdPct}%</p>`;
    if (t.exp10plusPct != null) tcHtml += `<p><span class="font-medium">10年以上經驗：</span>${t.exp10plusPct}%</p>`;
    tcHtml += `</div>`;
  }
  if (school.classStructure?.current) {
    const c = school.classStructure.current;
    tcHtml += `<div class="space-y-1">`;
    tcHtml += `<h5 class="font-medium text-xs text-base-content/50 uppercase mb-1">班級結構</h5>`;
    tcHtml += `<p>小一: ${c.p1 ?? '-'} | 小二: ${c.p2 ?? '-'} | 小三: ${c.p3 ?? '-'} | 小四: ${c.p4 ?? '-'} | 小五: ${c.p5 ?? '-'} | 小六: ${c.p6 ?? '-'} | 合共: ${c.total ?? '-'}</p>`;
    tcHtml += `</div>`;
  }
  html += collapseSection('教師及班級', tcHtml);

  // Section 5: Campus & Activities
  let campusHtml = '';
  if (school.facilities) {
    const fac = school.facilities;
    campusHtml += `<div class="space-y-1 mb-3">`;
    campusHtml += `<h5 class="font-medium text-xs text-base-content/50 uppercase mb-1">設施</h5>`;
    campusHtml += `<p><span class="font-medium">課室：</span>${fac.classrooms ?? '-'}間 · 操場：${fac.playgrounds ?? '-'}個 · 禮堂：${fac.halls ?? '-'}個 · 圖書館：${fac.libraries ?? '-'}個</p>`;
    if (school.campusArea) campusHtml += `<p><span class="font-medium">佔地面積：</span>${school.campusArea}</p>`;
    if (fac.specialRooms) campusHtml += `<p><span class="font-medium">特別室：</span>${fac.specialRooms}</p>`;
    if (fac.otherFacilities) campusHtml += `<p><span class="font-medium">其他設施：</span>${fac.otherFacilities}</p>`;
    if (fac.senFacilities && fac.senFacilities !== '-') campusHtml += `<p><span class="font-medium">無障礙設施：</span>${fac.senFacilities}</p>`;
    campusHtml += `</div>`;
  }
  if (school.ecas) {
    campusHtml += `<div class="space-y-1">`;
    campusHtml += `<h5 class="font-medium text-xs text-base-content/50 uppercase mb-1">課外活動</h5>`;
    campusHtml += `<p>${school.ecas}</p>`;
    campusHtml += `</div>`;
  }
  html += collapseSection('校園及活動', campusHtml);

  // Section 6: Development & Contact
  let devHtml = `<div class="space-y-1 mb-3">`;
  if (school.mission) devHtml += `<p><span class="font-medium">辦學宗旨：</span>${school.mission}</p>`;
  if (school.schoolEthos) devHtml += `<p><span class="font-medium">學校特色：</span>${school.schoolEthos}</p>`;
  if (school.parentCooperation) devHtml += `<p><span class="font-medium">家校合作：</span>${school.parentCooperation}</p>`;
  devHtml += `</div>`;
  devHtml += `<div class="divider my-1"></div>`;
  devHtml += `<div class="space-y-1">`;
  devHtml += `<h5 class="font-medium text-xs text-base-content/50 uppercase mb-1">聯絡資訊</h5>`;
  if (school.address) devHtml += `<p><span class="font-medium">地址：</span>${school.address}</p>`;
  if (school.phone) devHtml += `<p><span class="font-medium">電話：</span>${school.phone}</p>`;
  if (school.fax) devHtml += `<p><span class="font-medium">傳真：</span>${school.fax}</p>`;
  if (school.email) devHtml += `<p><span class="font-medium">電郵：</span>${school.email}</p>`;
  if (school.website) devHtml += `<p><span class="font-medium">網站：</span><a href="${school.website}" target="_blank" class="link link-primary">${school.website}</a></p>`;
  devHtml += `</div>`;
  html += collapseSection('學校發展及聯絡', devHtml);

  html += `</div>`; // close space-y-2

  // === RATING & NOTES (unchanged) ===
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

  content.innerHTML = html;
  document.getElementById('detail-modal').showModal();
}

window.__setRating = async function(id, rating) {
  const { requireAuth } = await import('./auth.js');
  requireAuth(async () => {
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
  });
};

window.__saveNotes = async function(id, btn) {
  const { requireAuth } = await import('./auth.js');
  requireAuth(async () => {
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
  });
};
