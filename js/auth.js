/**
 * AETHERBUILDER - ARGON2 CRYPTOGRAPHIC AUTHENTICATION ENGINE
 * Uses WebAssembly Argon2id for secure password hashing and verification.
 */

const AUTH_STORAGE_KEY = 'aether_argon2_master_hash';
const SESSION_STORAGE_KEY = 'aether_admin_session';
const TOKEN_STORAGE_KEY    = 'aether_admin_token';

export const DEFAULT_ADMIN_HASH = '$argon2id$v=19$m=4096,t=3,p=1$AQIDBAUGBwgJCgsMDQ4PEA$AcLtZ2LeyjAEESISSgm0dbsP0qO7+uGaVzDF6ei+1Xw';

export class Argon2Auth {
  constructor() {
    this.hashwasm = window.hashwasm || null;
    this.isReady = false;
    this._enginePromise = null;
    this.initPromise = this.init();
  }

  async ensureEngineReady() {
    if (this.hashwasm && this.hashwasm.argon2id) return true;
    if (window.hashwasm && window.hashwasm.argon2id) {
      this.hashwasm = window.hashwasm;
      this.isReady = true;
      return true;
    }
    if (!this._enginePromise) {
      this._enginePromise = (async () => {
        let attempts = 0;
        while ((!window.hashwasm || !window.hashwasm.argon2id) && attempts < 25) {
          await new Promise((r) => setTimeout(r, 100));
          attempts++;
        }
        this.hashwasm = window.hashwasm || null;
        this.isReady = !!(this.hashwasm && this.hashwasm.argon2id);
        return this.isReady;
      })();
    }
    return await this._enginePromise;
  }

  async init() {
    try {
      await this.ensureEngineReady();
      await this.ensureDefaultAdmin();
    } catch (err) {
      console.warn('Argon2 init non-blocking warn:', err);
    }
    return this.isReady;
  }

  // Generates cryptographically secure salt
  generateSalt(length = 16) {
    const salt = new Uint8Array(length);
    window.crypto.getRandomValues(salt);
    return salt;
  }

  // Hashes password using Argon2id with recommended memory and iteration parameters
  async hashPassword(password) {
    await this.ensureEngineReady();
    if (!this.hashwasm || !this.hashwasm.argon2id) {
      throw new Error('Argon2 WebAssembly engine is not available.');
    }

    const salt = this.generateSalt(16);
    const hash = await this.hashwasm.argon2id({
      password: password,
      salt: salt,
      parallelism: 1,
      iterations: 3,
      memorySize: 4096, // 4MB RAM cost in browser
      hashLength: 32,
      outputType: 'encoded' // Standard PHC Argon2 format
    });

    return hash;
  }

  // Verifies password against standard Argon2 PHC string
  async verifyPassword(password, encodedHash) {
    await this.ensureEngineReady();
    if (!this.hashwasm || !this.hashwasm.argon2Verify) {
      throw new Error('Argon2 WebAssembly verify engine is not available.');
    }

    const isValid = await this.hashwasm.argon2Verify({
      password: password,
      hash: encodedHash
    });

    return isValid;
  }

  // Ensures there is an initial admin hash in localStorage (default: 'admin123')
  async ensureDefaultAdmin() {
    let currentHash = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!currentHash) {
      currentHash = DEFAULT_ADMIN_HASH;
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, currentHash);
        console.log('✅ Master security credentials initialized.');
      } catch (err) {
        console.warn('Could not persist default admin hash:', err);
      }
    }
  }

  getStoredHash() {
    return localStorage.getItem(AUTH_STORAGE_KEY) || '';
  }

  isAuthenticated() {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) === 'authenticated';
  }

  setSession(status) {
    if (status) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, 'authenticated');
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  logout() {
    this.setSession(false);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    window.location.reload();
  }

  async login(password) {
    await this.initPromise;
    let storedHash = this.getStoredHash();
    if (!storedHash) {
      await this.ensureDefaultAdmin();
      storedHash = this.getStoredHash();
    }

    const targetHash = storedHash || DEFAULT_ADMIN_HASH;
    const startTime = performance.now();
    let valid = false;

    try {
      valid = await this.verifyPassword(password, targetHash);
    } catch (err) {
      console.warn('Argon2 verify engine warning, checking fallback:', err);
      if (password === 'admin123' && (!targetHash || targetHash === DEFAULT_ADMIN_HASH)) {
        valid = true;
      }
    }

    // Direct fallback for initial default admin password
    if (!valid && password === 'admin123' && (!targetHash || targetHash === DEFAULT_ADMIN_HASH)) {
      valid = true;
    }

    const computeTime = Math.round(performance.now() - startTime);

    if (valid) {
      this._adminPass = password;
      // Obtain server-side session token (validates this browser session server-side)
      try {
        const res = await fetch('api.php?action=verify_session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ argon2_hash: targetHash, password: password })
        });
        const data = await res.json();
        if (data && data.token) {
          sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
        }
      } catch (e) {
        console.warn('verify_session fetch failed, continuing with local session:', e);
      }
      this.setSession(true);
      return { success: true, computeTime };
    } else {
      return { success: false, error: 'Invalid admin password.', computeTime };
    }
  }

  getAdminPassword() {
    return this._adminPass || '';
  }

  /** Ensures a valid server-side session token is present; fetches one if missing */
  async ensureSessionToken() {
    if (this.isAuthenticated() && !this.getAdminToken()) {
      try {
        const targetHash = this.getStoredHash();
        const res = await fetch('api.php?action=verify_session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ argon2_hash: targetHash })
        });
        const data = await res.json();
        if (data && data.token) {
          sessionStorage.setItem(TOKEN_STORAGE_KEY, data.token);
        }
      } catch (err) {
        console.warn('ensureSessionToken background call failed:', err);
      }
    }
  }

  /** Returns the server-signed session token stored in sessionStorage */
  getAdminToken() {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
  }

  /** Checks whether a server session token is present (doesn't re-verify server-side) */
  hasValidToken() {
    return !!sessionStorage.getItem(TOKEN_STORAGE_KEY);
  }

  async updatePassword(oldPassword, newPassword) {
    await this.initPromise;
    const verifyRes = await this.login(oldPassword);
    if (!verifyRes.success) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'New password must be at least 4 characters.' };
    }

    const newHash = await this.hashPassword(newPassword);
    localStorage.setItem(AUTH_STORAGE_KEY, newHash);
    // Persist new hash server-side
    try {
      await fetch('api.php?action=save_admin_hash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': this.getAdminToken()
        },
        body: JSON.stringify({ argon2_hash: newHash })
      });
    } catch (e) {
      console.warn('Could not sync password to server:', e);
    }
    return { success: true, newHash };
  }

  // Renders the clean interactive admin login modal
  showLoginModal(onSuccess) {
    let existing = document.getElementById('argon2-login-modal');
    if (existing) existing.remove();

    // Ensure any loading overlay is dismissed so login modal is interactive
    const loader = document.getElementById('aether-initial-loader');
    if (loader) loader.remove();

    // Ensure document.body has dark background
    document.body.style.backgroundColor = '#090d16';
    document.body.style.color = '#e2e8f0';

    const modal = document.createElement('div');
    modal.id = 'argon2-login-modal';
    modal.className = 'modal-overlay animate-fade-in';
    modal.style.cssText = 'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(9,13,22,0.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);';
    modal.innerHTML = `
      <div class="modal-box animate-scale-in" style="background:#111827;border:1px solid rgba(255,255,255,0.14);border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,0.85),0 0 35px rgba(99,102,241,0.2);width:100%;max-width:420px;overflow:hidden;display:flex;flex-direction:column;color:#f8fafc;">
        <div style="text-align: center; padding: 26px 20px 14px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06);">
          <img src="assets/logo.png" alt="AetherBuilder" style="max-height: 76px; width: auto; object-fit: contain; filter: drop-shadow(0 4px 16px rgba(99,102,241,0.25)); border-radius: 10px;" />
        </div>
        <div class="modal-header" style="padding:16px 22px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.06);">
          <div class="modal-title" style="display:flex;align-items:center;gap:10px;">
            <span style="font-size: 1.3rem;">🔐</span>
            <div>
              <div style="font-weight:700;font-size:1.05rem;color:#fff;">Admin Sign In</div>
              <div style="font-size: 0.76rem; color: #94a3b8; font-weight: 500;">Secure Studio Access</div>
            </div>
          </div>
          <button class="tool-icon-btn" id="close-login-btn" title="Back to public site" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:1.1rem;padding:4px 8px;">✕</button>
        </div>
        <form id="argon2-login-form" class="modal-body" style="padding:20px 22px 16px;display:flex;flex-direction:column;gap:16px;">
          <p style="font-size: 0.88rem; color: #94a3b8; margin: 0; line-height: 1.5;">
            Please enter your administrator password to unlock the studio.
          </p>

          <div class="prop-group" style="display:flex;flex-direction:column;gap:6px;">
            <label class="prop-label" for="admin-pass-input" style="font-size:0.8rem;font-weight:600;color:#cbd5e1;">Master Password</label>
            <div style="position:relative;display:flex;align-items:center;width:100%;">
              <input type="password" id="admin-pass-input" placeholder="Enter password..." autocomplete="current-password" autofocus required style="width:100%;padding:11px 44px 11px 12px;background:#090d16;border:1px solid rgba(99,102,241,0.35);border-radius:8px;color:#fff;font-size:0.95rem;box-sizing:border-box;outline:none;" />
              <button type="button" id="toggle-pass-visibility" title="Show/hide password" style="position:absolute;right:8px;background:none;border:none;color:#94a3b8;cursor:pointer;padding:6px;font-size:1rem;display:flex;align-items:center;justify-content:center;">👁️</button>
            </div>
          </div>

          <div id="login-error-msg" style="color: #f87171; font-size: 0.82rem; font-weight: 600; min-height: 18px;"></div>

          <button type="submit" id="login-submit-btn" class="wb-btn wb-btn-primary" style="width: 100%; padding:11px; background:linear-gradient(135deg,#6366f1,#4f46e5); border:none; border-radius:8px; color:#fff; font-weight:700; font-size:0.92rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition: opacity 0.2s;">
            <span id="login-btn-text">Sign In</span>
            <span id="login-spinner" style="display: none;" class="animate-spin">⚙️</span>
          </button>
        </form>
        <div class="modal-footer" style="padding:12px 22px;background:rgba(0,0,0,0.25);border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;">
          <a href="?view=public" id="return-public-link" style="font-size: 0.82rem; color: #94a3b8; text-decoration:none;">← Return to Public Site</a>
          <span style="font-size: 0.74rem; color: #64748b;">Protected Studio</span>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector('#argon2-login-form');
    const passInput = modal.querySelector('#admin-pass-input');
    const errorMsg = modal.querySelector('#login-error-msg');
    const submitBtn = modal.querySelector('#login-submit-btn');
    const btnText = modal.querySelector('#login-btn-text');
    const spinner = modal.querySelector('#login-spinner');
    const toggleEye = modal.querySelector('#toggle-pass-visibility');
    const closeBtn = modal.querySelector('#close-login-btn');
    const returnPublicLink = modal.querySelector('#return-public-link');

    // Show/hide password toggle
    if (toggleEye && passInput) {
      toggleEye.addEventListener('click', () => {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        toggleEye.textContent = isPass ? '🙈' : '👁️';
      });
    }

    const handleExit = (e) => {
      e?.preventDefault();
      modal.remove();
      if (window.aetherApp && typeof window.aetherApp.switchToPublic === 'function') {
        window.aetherApp.switchToPublic();
      } else {
        window.location.href = '?view=public';
      }
    };

    closeBtn.addEventListener('click', handleExit);
    returnPublicLink?.addEventListener('click', handleExit);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorMsg.textContent = '';
      submitBtn.disabled = true;
      btnText.textContent = 'Verifying...';
      spinner.style.display = 'inline-block';

      try {
        const res = await this.login(passInput.value);
        if (res.success) {
          btnText.textContent = '✓ Access Granted';
          modal.classList.add('animate-fade-out');
          setTimeout(() => {
            modal.remove();
            if (typeof onSuccess === 'function') onSuccess();
          }, 180);
        } else {
          errorMsg.textContent = res.error || 'Invalid password. Please try again.';
          modal.querySelector('.modal-box').classList.add('animate-shake');
          setTimeout(() => {
            modal.querySelector('.modal-box').classList.remove('animate-shake');
          }, 500);
          submitBtn.disabled = false;
          btnText.textContent = 'Sign In';
          spinner.style.display = 'none';
        }
      } catch (err) {
        errorMsg.textContent = `Error: ${err.message || 'Verification failed.'}`;
        submitBtn.disabled = false;
        btnText.textContent = 'Sign In';
        spinner.style.display = 'none';
      }
    });
  }
}

export const auth = new Argon2Auth();
