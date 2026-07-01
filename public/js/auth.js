import { setAppState, getAppState, fetchSchools, fetchSchoolNets, fetchUserData, buildDistrictNetsMap } from './shared.js';
import { initRouter, navigateTo } from './router.js';
import { initRanking, refreshRanking } from './ranking.js';
import { initDashboard } from './dashboard.js';
import { initAccount } from './account.js';

const SUPABASE_URL = window.__SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY || '';

let supabase = null;
let isLocalDev = false;
let booted = false;
let pendingAuthCallback = null;

export async function initAuth() {
  isLocalDev = !SUPABASE_URL || SUPABASE_URL.includes('%%') || location.hostname === 'localhost';

  if (isLocalDev) {
    await bootApp(null);
    return;
  }

  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: { session } } = await supabase.auth.getSession();
  await bootApp(session);

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session && booted) {
      await onLogin(session);
    } else if (event === 'SIGNED_OUT') {
      onLogout();
    }
  });
}

export function showLoginModal() {
  document.getElementById('email-login-form')?.classList.remove('hidden');
  document.getElementById('otp-verify-form')?.classList.add('hidden');
  document.getElementById('login-error')?.classList.add('hidden');
  document.getElementById('login-modal').showModal();
}

export function requireAuth(callback) {
  if (getAppState('session') || isLocalDev) {
    callback();
    return;
  }
  pendingAuthCallback = callback;
  showLoginModal();
}

function bindLoginEvents() {
  document.getElementById('google-login-btn').onclick = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
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

  const hasAuth = isLocalDev || session;
  const [schools, nets, userData] = await Promise.all([
    fetchSchools(),
    fetchSchoolNets(),
    hasAuth ? (isLocalDev ? loadLocalUserData() : fetchUserData()) : Promise.resolve({}),
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
    if (page === 'account') initAccount(getAppState('session'), supabase);
  });

  initRanking();
  updateAuthUI(session);

  if (!isLocalDev) {
    bindLoginEvents();
  }

  if (session && !preferences.onboardingCompleted && !isLocalDev) {
    const { showOnboarding } = await import('./onboarding.js');
    showOnboarding();
  }
}

async function onLogin(session) {
  setAppState('session', session);

  const userData = await fetchUserData();
  const preferences = userData._preferences || {};
  delete userData._preferences;
  setAppState('preferences', preferences);
  setAppState('userData', userData);

  const allSchools = getAppState('allSchools');
  allSchools.forEach(s => {
    if (userData[s.id]) s.userData = userData[s.id];
    else delete s.userData;
  });

  updateAuthUI(session);
  if (window.__onDataChange) window.__onDataChange();

  document.getElementById('login-modal').close();

  if (pendingAuthCallback) {
    const cb = pendingAuthCallback;
    pendingAuthCallback = null;
    cb();
  }

  if (!preferences.onboardingCompleted) {
    const { showOnboarding } = await import('./onboarding.js');
    showOnboarding();
  }
}

function onLogout() {
  setAppState('session', null);
  setAppState('userData', {});
  setAppState('preferences', {});

  const allSchools = getAppState('allSchools');
  allSchools.forEach(s => { delete s.userData; });

  updateAuthUI(null);
  if (window.__onDataChange) window.__onDataChange();
}

function updateAuthUI(session) {
  const sidebarAuth = document.getElementById('sidebar-auth');
  const sidebarUser = document.getElementById('sidebar-user');
  const sidebarEmail = document.getElementById('sidebar-email');
  const mobileLogin = document.getElementById('mobile-login-btn');
  const mobileLogout = document.getElementById('mobile-logout-btn');

  if (session) {
    const email = session.user?.email || session.user?.user_metadata?.full_name || '';
    if (sidebarAuth) sidebarAuth.classList.add('hidden');
    if (sidebarUser) {
      sidebarUser.classList.remove('hidden');
      sidebarEmail.textContent = email;
    }
    if (mobileLogin) mobileLogin.classList.add('hidden');
    if (mobileLogout) mobileLogout.classList.remove('hidden');
  } else {
    if (sidebarAuth) sidebarAuth.classList.remove('hidden');
    if (sidebarUser) sidebarUser.classList.add('hidden');
    if (mobileLogin) mobileLogin.classList.remove('hidden');
    if (mobileLogout) mobileLogout.classList.add('hidden');
  }

  document.getElementById('sidebar-login-btn')?.addEventListener('click', showLoginModal);
  document.getElementById('mobile-login-btn')?.addEventListener('click', showLoginModal);
  document.getElementById('sidebar-logout-btn')?.addEventListener('click', () => signOut());
  document.getElementById('mobile-logout-btn')?.addEventListener('click', () => signOut());
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
