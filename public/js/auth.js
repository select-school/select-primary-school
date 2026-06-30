import { setAppState, fetchSchools, fetchSchoolNets, fetchUserData, buildDistrictNetsMap } from './shared.js';
import { initRouter, navigateTo } from './router.js';
import { initRanking, refreshRanking } from './ranking.js';
import { initDashboard } from './dashboard.js';
import { initAccount } from './account.js';

const SUPABASE_URL = window.__SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY || '';

let supabase = null;
let isLocalDev = false;
let booted = false;

export async function initAuth() {
  isLocalDev = !SUPABASE_URL || SUPABASE_URL.includes('%%') || location.hostname === 'localhost';

  if (isLocalDev) {
    await bootApp(null);
    return;
  }

  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await bootApp(session);
  } else {
    showLoginPage();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await bootApp(session);
    } else if (event === 'SIGNED_OUT') {
      showLoginPage();
    }
  });
}

function showLoginPage() {
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
  bindLoginEvents();
}

function bindLoginEvents() {
  document.getElementById('google-login-btn').onclick = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) showLoginError(error.message);
  };

  document.getElementById('email-otp-btn').onclick = async () => {
    const email = document.getElementById('login-email').value.trim();
    if (!email) return showLoginError('請輸入電郵地址');
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) return showLoginError(error.message);
    document.getElementById('email-login-form').classList.add('hidden');
    document.getElementById('otp-verify-form').classList.remove('hidden');
  };

  document.getElementById('otp-verify-btn').onclick = async () => {
    const email = document.getElementById('login-email').value.trim();
    const token = document.getElementById('otp-code').value.trim();
    if (!token) return showLoginError('請輸入驗證碼');
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) showLoginError(error.message);
  };

  document.getElementById('otp-back-btn').onclick = () => {
    document.getElementById('email-login-form').classList.remove('hidden');
    document.getElementById('otp-verify-form').classList.add('hidden');
    hideLoginError();
  };
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideLoginError() {
  document.getElementById('login-error').classList.add('hidden');
}

async function bootApp(session) {
  if (booted) return;
  booted = true;
  setAppState('session', session);

  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');

  const [schools, nets, userData] = await Promise.all([
    fetchSchools(),
    fetchSchoolNets(),
    isLocalDev ? loadLocalUserData() : fetchUserData(),
  ]);

  setAppState('allSchools', schools);
  setAppState('schoolNets', nets);
  setAppState('districtNetsMap', buildDistrictNetsMap(nets));

  const preferences = userData._preferences || {};
  delete userData._preferences;
  setAppState('preferences', preferences);
  setAppState('userData', userData);

  schools.forEach(s => {
    if (userData[s.id]) s.userData = userData[s.id];
  });

  window.__onDataChange = () => {
    refreshRanking();
    initDashboard();
  };

  initRouter((page) => {
    if (page === 'dashboard') initDashboard();
    if (page === 'account') initAccount(session, supabase);
  });

  initRanking();

  if (!preferences.onboardingCompleted && !isLocalDev) {
    const { showOnboarding } = await import('./onboarding.js');
    showOnboarding();
  }
}

async function loadLocalUserData() {
  try {
    const res = await fetch('/api/user-data');
    return res.json();
  } catch {
    return {};
  }
}

export function getSession() {
  return supabase ? supabase.auth.getSession() : null;
}

export async function signOut() {
  if (supabase) {
    await supabase.auth.signOut();
  } else {
    location.reload();
  }
}
