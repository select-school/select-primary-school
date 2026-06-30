import { getAppState, setAppState, savePreferences, buildDistrictNetsMap } from './shared.js';
import { navigateTo } from './router.js';

const TOTAL_STEPS = 4;
let currentStep = 1;
let selections = { districts: [], schoolNets: [], schoolTypes: ['男女校', '男校', '女校'] };

export function showOnboarding() {
  currentStep = 1;
  selections = { districts: [], schoolNets: [], schoolTypes: ['男女校', '男校', '女校'] };
  renderStep();
  document.getElementById('onboarding-modal').showModal();
}

function renderStep() {
  const content = document.getElementById('onboarding-content');
  content.innerHTML = '';

  const dots = document.createElement('div');
  dots.className = 'flex justify-center gap-2 mb-6';
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    dots.innerHTML += `<span class="w-2 h-2 rounded-full ${i === currentStep ? 'bg-primary' : 'bg-base-300'}"></span>`;
  }
  content.appendChild(dots);

  if (currentStep === 1) renderWelcome(content);
  else if (currentStep === 2) renderRegionStep(content);
  else if (currentStep === 3) renderTypeStep(content);
  else if (currentStep === 4) renderSummary(content);
}

function renderWelcome(container) {
  container.innerHTML += `
    <div class="text-center py-4">
      <h2 class="text-xl font-bold mb-2">🏫 幫你揀小學</h2>
      <p class="text-base-content/60">設定你的偏好，方便整理和比較心儀學校</p>
      <div class="mt-8 space-y-2">
        <button id="onboard-start" class="btn btn-primary w-full">開始設定</button>
        <button id="onboard-skip" class="btn btn-ghost btn-sm w-full">略過</button>
      </div>
    </div>
  `;
  container.querySelector('#onboard-start').onclick = () => { currentStep = 2; renderStep(); };
  container.querySelector('#onboard-skip').onclick = () => skipOnboarding();
}

function renderRegionStep(container) {
  const schoolNets = getAppState('schoolNets');
  const districtNetsMap = getAppState('districtNetsMap');
  const districts = [...new Set(Object.values(schoolNets))].sort();
  const nets = [...new Set(Object.keys(schoolNets).map(Number))].sort((a, b) => a - b);

  container.innerHTML += `
    <h3 class="text-lg font-bold mb-1">地區 / 校網偏好</h3>
    <p class="text-sm text-base-content/60 mb-4">你想以地區還是校網篩選？</p>
    <div class="tabs tabs-boxed mb-4">
      <a id="tab-district" class="tab tab-active">按地區</a>
      <a id="tab-net" class="tab">按校網</a>
    </div>
    <div id="onboard-district-list" class="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto"></div>
    <div id="onboard-net-list" class="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto hidden"></div>
    <div class="mt-6 flex justify-between">
      <button id="onboard-back-2" class="btn btn-ghost btn-sm">返回</button>
      <div class="flex gap-2">
        <button id="onboard-skip-2" class="btn btn-ghost btn-sm">略過</button>
        <button id="onboard-next-2" class="btn btn-primary btn-sm">下一步</button>
      </div>
    </div>
  `;

  const districtList = container.querySelector('#onboard-district-list');
  districts.forEach(d => {
    districtList.innerHTML += `<label class="flex items-center gap-2 p-1 cursor-pointer hover:bg-base-200 rounded">
      <input type="checkbox" class="checkbox checkbox-sm onboard-district" value="${d}" ${selections.districts.includes(d) ? 'checked' : ''}>
      <span class="text-sm">${d}</span>
    </label>`;
  });

  const netList = container.querySelector('#onboard-net-list');
  nets.forEach(n => {
    netList.innerHTML += `<label class="flex items-center gap-2 p-1 cursor-pointer hover:bg-base-200 rounded">
      <input type="checkbox" class="checkbox checkbox-sm onboard-net" value="${n}" ${selections.schoolNets.includes(n) ? 'checked' : ''}>
      <span class="text-sm">${n} (${schoolNets[String(n)]})</span>
    </label>`;
  });

  // Tab toggle
  container.querySelector('#tab-district').onclick = () => {
    container.querySelector('#tab-district').classList.add('tab-active');
    container.querySelector('#tab-net').classList.remove('tab-active');
    districtList.classList.remove('hidden');
    netList.classList.add('hidden');
  };
  container.querySelector('#tab-net').onclick = () => {
    container.querySelector('#tab-net').classList.add('tab-active');
    container.querySelector('#tab-district').classList.remove('tab-active');
    netList.classList.remove('hidden');
    districtList.classList.add('hidden');
  };

  // Bidirectional sync
  districtList.addEventListener('change', (e) => {
    const district = e.target.value;
    const checked = e.target.checked;
    (districtNetsMap[district] || []).forEach(netNum => {
      const netCb = container.querySelector(`.onboard-net[value="${netNum}"]`);
      if (netCb) netCb.checked = checked;
    });
  });

  netList.addEventListener('change', (e) => {
    const netNum = Number(e.target.value);
    const district = schoolNets[String(netNum)];
    if (district) {
      const netsForDistrict = districtNetsMap[district] || [];
      const anyChecked = netsForDistrict.some(n => {
        const cb = container.querySelector(`.onboard-net[value="${n}"]`);
        return cb && cb.checked;
      });
      const distCb = container.querySelector(`.onboard-district[value="${district}"]`);
      if (distCb) distCb.checked = anyChecked;
    }
  });

  container.querySelector('#onboard-back-2').onclick = () => { currentStep = 1; renderStep(); };
  container.querySelector('#onboard-skip-2').onclick = () => skipOnboarding();
  container.querySelector('#onboard-next-2').onclick = () => {
    selections.districts = [...container.querySelectorAll('.onboard-district:checked')].map(cb => cb.value);
    selections.schoolNets = [...container.querySelectorAll('.onboard-net:checked')].map(cb => Number(cb.value));
    currentStep = 3;
    renderStep();
  };
}

function renderTypeStep(container) {
  const types = ['男女校', '男校', '女校'];
  container.innerHTML += `
    <h3 class="text-lg font-bold mb-1">學校類型</h3>
    <p class="text-sm text-base-content/60 mb-4">你想看哪些學校類型？</p>
    <div class="space-y-2" id="onboard-types"></div>
    <div class="mt-6 flex justify-between">
      <button id="onboard-back-3" class="btn btn-ghost btn-sm">返回</button>
      <div class="flex gap-2">
        <button id="onboard-skip-3" class="btn btn-ghost btn-sm">略過</button>
        <button id="onboard-next-3" class="btn btn-primary btn-sm">下一步</button>
      </div>
    </div>
  `;

  const typesContainer = container.querySelector('#onboard-types');
  types.forEach(t => {
    typesContainer.innerHTML += `<label class="flex items-center gap-3 p-2 cursor-pointer hover:bg-base-200 rounded">
      <input type="checkbox" class="checkbox onboard-type" value="${t}" ${selections.schoolTypes.includes(t) ? 'checked' : ''}>
      <span>${t}</span>
    </label>`;
  });

  container.querySelector('#onboard-back-3').onclick = () => { currentStep = 2; renderStep(); };
  container.querySelector('#onboard-skip-3').onclick = () => skipOnboarding();
  container.querySelector('#onboard-next-3').onclick = () => {
    selections.schoolTypes = [...container.querySelectorAll('.onboard-type:checked')].map(cb => cb.value);
    currentStep = 4;
    renderStep();
  };
}

function renderSummary(container) {
  const schoolNets = getAppState('schoolNets');
  container.innerHTML += `
    <h3 class="text-lg font-bold mb-4">設定總結</h3>
    <div class="space-y-3 text-sm">
      <div>
        <span class="font-medium">地區：</span>
        ${selections.districts.length ? selections.districts.join('、') : '<span class="text-base-content/40">未設定</span>'}
      </div>
      <div>
        <span class="font-medium">校網：</span>
        ${selections.schoolNets.length ? selections.schoolNets.map(n => `${n} (${schoolNets[String(n)]})`).join('、') : '<span class="text-base-content/40">未設定</span>'}
      </div>
      <div>
        <span class="font-medium">學校類型：</span>
        ${selections.schoolTypes.length ? selections.schoolTypes.join('、') : '<span class="text-base-content/40">未設定</span>'}
      </div>
    </div>
    <div class="mt-6 flex justify-between">
      <button id="onboard-back-4" class="btn btn-ghost btn-sm">返回</button>
      <button id="onboard-save" class="btn btn-primary btn-sm">儲存設定</button>
    </div>
  `;

  container.querySelector('#onboard-back-4').onclick = () => { currentStep = 3; renderStep(); };
  container.querySelector('#onboard-save').onclick = () => completeOnboarding();
}

async function completeOnboarding() {
  const prefs = { ...selections, onboardingCompleted: true };
  await savePreferences(prefs);
  setAppState('preferences', prefs);
  document.getElementById('onboarding-modal').close();
  navigateTo('#dashboard');
  const { initDashboard } = await import('./dashboard.js');
  initDashboard();
}

async function skipOnboarding() {
  const prefs = { districts: [], schoolNets: [], schoolTypes: [], onboardingCompleted: true };
  await savePreferences(prefs);
  setAppState('preferences', prefs);
  document.getElementById('onboarding-modal').close();
  navigateTo('#dashboard');
}
