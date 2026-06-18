// ============================================================
// AURA AUTH MODULE
// Client-side auth using SHA-256 (Web Crypto API) + sessionStorage
// ============================================================

const AUTH_CRED_KEY  = 'aura-auth-credentials';
const AUTH_SESSION_KEY = 'aura-session';
const AUTH_LOCK_KEY  = 'aura-lockout';

// Default credentials (set on first load, user can change them)
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'aura@2024';

// Max failed attempts before 30-second lockout
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

// ─── Crypto helpers ─────────────────────────────────────────

async function sha256(str) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Credential bootstrap ───────────────────────────────────

async function getCredentials() {
  const raw = localStorage.getItem(AUTH_CRED_KEY);
  if (raw) return JSON.parse(raw);

  // First run — seed defaults
  const passwordHash = await sha256(DEFAULT_PASSWORD);
  const creds = { username: DEFAULT_USERNAME, passwordHash };
  localStorage.setItem(AUTH_CRED_KEY, JSON.stringify(creds));
  return creds;
}

// ─── Session ────────────────────────────────────────────────

function isLoggedIn() {
  return !!sessionStorage.getItem(AUTH_SESSION_KEY);
}

async function createSession(username) {
  const token = await sha256(`${username}:${Date.now()}:${Math.random()}`);
  sessionStorage.setItem(AUTH_SESSION_KEY, token);
}

function logout() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  window.location.reload();
}

// ─── Lockout guard ──────────────────────────────────────────

function getLockoutData() {
  return JSON.parse(localStorage.getItem(AUTH_LOCK_KEY) || '{"attempts":0,"since":0}');
}

function setLockoutData(data) {
  localStorage.setItem(AUTH_LOCK_KEY, JSON.stringify(data));
}

function isLockedOut() {
  const { attempts, since } = getLockoutData();
  if (attempts >= MAX_ATTEMPTS) {
    if (Date.now() - since < LOCKOUT_MS) return true;
    // Lockout expired — reset
    setLockoutData({ attempts: 0, since: 0 });
  }
  return false;
}

function recordFailedAttempt() {
  const data = getLockoutData();
  data.attempts += 1;
  if (data.attempts === 1) data.since = Date.now();
  setLockoutData(data);
}

function resetAttempts() {
  setLockoutData({ attempts: 0, since: 0 });
}

function remainingLockoutSecs() {
  const { since } = getLockoutData();
  return Math.ceil((LOCKOUT_MS - (Date.now() - since)) / 1000);
}

// ─── Login ──────────────────────────────────────────────────

async function attemptLogin(username, password) {
  if (isLockedOut()) {
    return {
      success: false,
      error: `Too many attempts. Try again in ${remainingLockoutSecs()}s.`,
      locked: true,
    };
  }

  const creds = await getCredentials();
  const hash = await sha256(password);

  if (username.trim() === creds.username && hash === creds.passwordHash) {
    resetAttempts();
    await createSession(username);
    return { success: true };
  }

  recordFailedAttempt();
  const data = getLockoutData();
  const remaining = MAX_ATTEMPTS - data.attempts;
  return {
    success: false,
    error: remaining > 0
      ? `Incorrect credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
      : `Too many attempts. Locked for ${remainingLockoutSecs()}s.`,
  };
}

// ─── Change password ────────────────────────────────────────

async function changePassword(currentPassword, newPassword) {
  if (newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters.' };
  }

  const creds = await getCredentials();
  const currentHash = await sha256(currentPassword);

  if (currentHash !== creds.passwordHash) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  creds.passwordHash = await sha256(newPassword);
  localStorage.setItem(AUTH_CRED_KEY, JSON.stringify(creds));
  return { success: true };
}

// ─── Change username ────────────────────────────────────────

async function changeUsername(newUsername, currentPassword) {
  if (!newUsername.trim() || newUsername.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' };
  }

  const creds = await getCredentials();
  const hash = await sha256(currentPassword);

  if (hash !== creds.passwordHash) {
    return { success: false, error: 'Password confirmation failed.' };
  }

  creds.username = newUsername.trim();
  localStorage.setItem(AUTH_CRED_KEY, JSON.stringify(creds));
  return { success: true };
}

// ─── UI Controller ──────────────────────────────────────────

function initAuthUI() {
  const overlay = document.getElementById('login-overlay');
  const form    = document.getElementById('login-form');
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const togglePwBtn   = document.getElementById('toggle-password-visibility');
  const loginBtn      = document.getElementById('login-submit-btn');
  const errorMsg      = document.getElementById('login-error-msg');
  const loginCard     = document.getElementById('login-card');

  // Password visibility toggle
  togglePwBtn.addEventListener('click', () => {
    const isText = passwordInput.type === 'text';
    passwordInput.type = isText ? 'password' : 'text';
    togglePwBtn.innerHTML = isText
      ? '<i data-lucide="eye" class="icon-sm"></i>'
      : '<i data-lucide="eye-off" class="icon-sm"></i>';
    lucide.createIcons();
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.textContent = '';
    errorMsg.style.display = 'none';

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="login-spinner"></span> Verifying...';

    const result = await attemptLogin(
      usernameInput.value,
      passwordInput.value
    );

    if (result.success) {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.style.display = 'none';
        document.getElementById('app-container-wrapper').style.display = 'flex';
        // Trigger app init
        window.dispatchEvent(new CustomEvent('auth:login'));
      }, 400);
    } else {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<span>Sign In</span><i data-lucide="arrow-right" class="icon-sm"></i>';
      lucide.createIcons();

      errorMsg.textContent = result.error;
      errorMsg.style.display = 'flex';

      // Shake animation
      loginCard.classList.remove('shake');
      void loginCard.offsetWidth; // reflow
      loginCard.classList.add('shake');
    }
  });

  // Show overlay if not logged in
  if (!isLoggedIn()) {
    overlay.style.display = 'flex';
    document.getElementById('app-container-wrapper').style.display = 'none';
    setTimeout(() => usernameInput.focus(), 200);
  } else {
    overlay.style.display = 'none';
    document.getElementById('app-container-wrapper').style.display = 'flex';
  }
}

// ─── Change-Password Modal Controller ───────────────────────

function initChangePasswordModal() {
  const modal      = document.getElementById('change-pwd-modal');
  const openBtn    = document.getElementById('open-change-pwd-btn');
  const closeBtn   = document.getElementById('close-change-pwd-btn');
  const form       = document.getElementById('change-pwd-form');
  const errorEl    = document.getElementById('change-pwd-error');
  const successEl  = document.getElementById('change-pwd-success');

  openBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
    form.reset();
    errorEl.style.display = 'none';
    successEl.style.display = 'none';
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const currentPwd = document.getElementById('current-password').value;
    const newPwd     = document.getElementById('new-password').value;
    const confirmPwd = document.getElementById('confirm-password').value;

    if (newPwd !== confirmPwd) {
      errorEl.textContent = 'New passwords do not match.';
      errorEl.style.display = 'flex';
      return;
    }

    const result = await changePassword(currentPwd, newPwd);

    if (result.success) {
      successEl.style.display = 'flex';
      form.reset();
      setTimeout(() => { modal.style.display = 'none'; }, 1800);
    } else {
      errorEl.textContent = result.error;
      errorEl.style.display = 'flex';
    }
  });
}

// ─── Logout button ──────────────────────────────────────────

function initLogoutBtn() {
  document.getElementById('logout-btn').addEventListener('click', () => {
    if (confirm('Sign out of AURA?')) logout();
  });
}
