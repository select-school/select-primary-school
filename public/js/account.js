import { getAppState, setAppState, savePreferences, buildDistrictNetsMap } from './shared.js';
import { signOut } from './auth.js';

export function initAccount(session, supabase) {
  const container = document.getElementById('account-content');
  if (!container) return;

  if (!session) {
    container.innerHTML = `
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body p-6 items-center text-center">
          <h3 class="text-lg font-bold">登入帳戶</h3>
          <p class="text-sm text-base-content/60 mt-2">登入以儲存你的學校評級、備註和偏好設定</p>
          <button id="account-login-btn" class="btn btn-primary mt-4">登入 / 註冊</button>
        </div>
      </div>
    `;
    container.querySelector('#account-login-btn').addEventListener('click', async () => {
      const { showLoginModal } = await import('./auth.js');
      showLoginModal();
    });
    return;
  }

  const prefs = getAppState('preferences');
  const schoolNets = getAppState('schoolNets');
  const districtNetsMap = getAppState('districtNetsMap');
  const districts = [...new Set(Object.values(schoolNets))].sort();
  const nets = [...new Set(Object.keys(schoolNets).map(Number))].sort((a, b) => a - b);

  const email = session?.user?.email || session?.user?.user_metadata?.full_name || '本機用戶';

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Account info -->
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body p-4">
          <h3 class="font-bold mb-2">帳戶資訊</h3>
          <p class="text-sm text-base-content/60">${email}</p>
          <button id="sign-out-btn" class="btn btn-outline btn-sm mt-3 w-fit">登出</button>
        </div>
      </div>

      <!-- Preferences -->
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body p-4">
          <h3 class="font-bold mb-4">偏好設定</h3>

          <!-- District / School Net -->
          <div class="mb-4">
            <label class="label"><span class="label-text font-medium">地區 / 校網</span></label>
            <div class="tabs tabs-boxed mb-2">
              <a id="acct-tab-district" class="tab tab-active">按地區</a>
              <a id="acct-tab-net" class="tab">按校網</a>
            </div>
            <div id="acct-district-list" class="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto"></div>
            <div id="acct-net-list" class="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto hidden"></div>
          </div>

          <!-- School types -->
          <div class="mb-4">
            <label class="label"><span class="label-text font-medium">學校類型</span></label>
            <div class="flex gap-4" id="acct-types"></div>
          </div>

          <button id="save-prefs-btn" class="btn btn-primary btn-sm">儲存</button>
          <span id="prefs-saved-msg" class="text-sm text-success ml-2 hidden">已儲存 ✓</span>
        </div>
      </div>

      <!-- Version -->
      <div class="text-xs text-base-content/30 text-center">v2.0.1</div>
    </div>
  `;

  // Populate district checkboxes
  const districtList = container.querySelector('#acct-district-list');
  districts.forEach(d => {
    districtList.innerHTML += `<label class="flex items-center gap-2 p-1 cursor-pointer hover:bg-base-200 rounded">
      <input type="checkbox" class="checkbox checkbox-sm acct-district" value="${d}" ${prefs.districts?.includes(d) ? 'checked' : ''}>
      <span class="text-sm">${d}</span>
    </label>`;
  });

  // Populate net checkboxes
  const netList = container.querySelector('#acct-net-list');
  nets.forEach(n => {
    netList.innerHTML += `<label class="flex items-center gap-2 p-1 cursor-pointer hover:bg-base-200 rounded">
      <input type="checkbox" class="checkbox checkbox-sm acct-net" value="${n}" ${prefs.schoolNets?.includes(n) ? 'checked' : ''}>
      <span class="text-sm">${n} (${schoolNets[String(n)]})</span>
    </label>`;
  });

  // Populate type checkboxes
  const typesContainer = container.querySelector('#acct-types');
  ['男女校', '男校', '女校'].forEach(t => {
    typesContainer.innerHTML += `<label class="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" class="checkbox checkbox-sm acct-type" value="${t}" ${prefs.schoolTypes?.includes(t) ? 'checked' : ''}>
      <span class="text-sm">${t}</span>
    </label>`;
  });

  // Tab toggle
  container.querySelector('#acct-tab-district').onclick = () => {
    container.querySelector('#acct-tab-district').classList.add('tab-active');
    container.querySelector('#acct-tab-net').classList.remove('tab-active');
    districtList.classList.remove('hidden');
    netList.classList.add('hidden');
  };
  container.querySelector('#acct-tab-net').onclick = () => {
    container.querySelector('#acct-tab-net').classList.add('tab-active');
    container.querySelector('#acct-tab-district').classList.remove('tab-active');
    netList.classList.remove('hidden');
    districtList.classList.add('hidden');
  };

  // Bidirectional sync
  districtList.addEventListener('change', (e) => {
    const district = e.target.value;
    const checked = e.target.checked;
    (districtNetsMap[district] || []).forEach(netNum => {
      const netCb = container.querySelector(`.acct-net[value="${netNum}"]`);
      if (netCb) netCb.checked = checked;
    });
  });

  netList.addEventListener('change', (e) => {
    const netNum = Number(e.target.value);
    const district = schoolNets[String(netNum)];
    if (district) {
      const netsForDistrict = districtNetsMap[district] || [];
      const anyChecked = netsForDistrict.some(n => {
        const cb = container.querySelector(`.acct-net[value="${n}"]`);
        return cb && cb.checked;
      });
      const distCb = container.querySelector(`.acct-district[value="${district}"]`);
      if (distCb) distCb.checked = anyChecked;
    }
  });

  // Save
  container.querySelector('#save-prefs-btn').onclick = async () => {
    const newPrefs = {
      districts: [...container.querySelectorAll('.acct-district:checked')].map(cb => cb.value),
      schoolNets: [...container.querySelectorAll('.acct-net:checked')].map(cb => Number(cb.value)),
      schoolTypes: [...container.querySelectorAll('.acct-type:checked')].map(cb => cb.value),
      onboardingCompleted: true,
    };
    await savePreferences(newPrefs);
    setAppState('preferences', newPrefs);
    const msg = container.querySelector('#prefs-saved-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2000);
  };

  // Sign out
  container.querySelector('#sign-out-btn').onclick = async () => {
    await signOut();
  };
}
