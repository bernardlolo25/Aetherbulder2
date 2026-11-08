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
        console.log('✅ Master Argon2id password initialized. Default: admin123');
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
    const storedHash = this.getStoredHash();
    if (!storedHash) {
      await this.ensureDefaultAdmin();
    }

    const targetHash = this.getStoredHash();
    const startTime = performance.now();
    const valid = await this.verifyPassword(password, targetHash);
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

  // Renders the interactive Argon2 login modal
  showLoginModal(onSuccess) {
    let existing = document.getElementById('argon2-login-modal');
    if (existing) existing.remove();

    // Ensure any loading overlay is dismissed so login modal is interactive
    const loader = document.getElementById('aether-initial-loader');
    if (loader) loader.remove();

    const storedHash = this.getStoredHash();
    const hashPreview = storedHash ? `${storedHash.substring(0, 32)}...` : 'Generating initial Argon2id state...';

    const modal = document.createElement('div');
    modal.id = 'argon2-login-modal';
    modal.className = 'modal-overlay animate-fade-in';
    modal.innerHTML = `
      <div class="modal-box animate-scale-in" style="max-width: 440px;">
        <div style="text-align: center; padding: 24px 20px 10px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06); border-top-left-radius: 12px; border-top-right-radius: 12px;">
          <img src="assets/logo.png" alt="AetherBuilder" style="max-height: 84px; width: auto; object-fit: contain; filter: drop-shadow(0 4px 16px rgba(99,102,241,0.25)); border-radius: 10px;" />
        </div>
        <div class="modal-header" style="padding-top: 14px;">
          <div class="modal-title">
            <span style="font-size: 1.3rem;">🔐</span>
            <div>
              <div>Admin Authentication</div>
              <div style="font-size: 0.75rem; color: var(--accent); font-weight: 500;">Argon2id Cryptographic Protection</div>
            </div>
          </div>
          <button class="tool-icon-btn" id="close-login-btn" title="Back to public view">✕</button>
        </div>
        <form id="argon2-login-form" class="modal-body">
          <p style="font-size: 0.92rem; color: var(--text-muted);">
            The AetherBuilder Admin Studio is locked. Enter your master password to decrypt session controls.
          </p>

          <div class="prop-group">
            <label class="prop-label" for="admin-pass-input">Admin Password</label>
            <input type="password" id="admin-pass-input" placeholder="Enter master password..." autocomplete="current-password" autofocus required />
            <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 4px;">
              Default password on first install is: <code style="color: var(--primary-light); background: rgba(99,102,241,0.15); padding: 2px 6px; border-radius: 4px;">admin123</code>
            </div>
          </div>

          <div class="argon2-verify-box">
            <div style="display: flex; justify-content: space-between; font-weight: 600;">
              <span>Active Argon2 PHC Hash:</span>
              <span id="argon2-calc-time" style="color: var(--success); font-family: var(--font-mono);">WebAssembly Ready</span>
            </div>
            <div class="argon2-hash-preview" id="argon2-hash-display">${hashPreview}</div>
          </div>

          <div id="login-error-msg" style="color: var(--danger); font-size: 0.85rem; font-weight: 600; min-height: 20px;"></div>

          <button type="submit" id="login-submit-btn" class="wb-btn wb-btn-primary" style="width: 100%;">
            <span>Unlock Admin Studio</span>
            <span id="login-spinner" style="display: none;" class="animate-spin">⚙️</span>
          </button>
        </form>
        <div class="modal-footer" style="justify-content: space-between;">
          <a href="?view=public" style="font-size: 0.82rem; color: var(--text-dim);">← Return to Public Site</a>
          <button type="button" id="quick-fill-btn" style="font-size: 0.8rem; color: var(--primary-light); text-decoration: underline;">
            Fill default (admin123)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector('#argon2-login-form');
    const passInput = modal.querySelector('#admin-pass-input');
    const errorMsg = modal.querySelector('#login-error-msg');
    const submitBtn = modal.querySelector('#login-submit-btn');
    const spinner = modal.querySelector('#login-spinner');
    const calcTime = modal.querySelector('#argon2-calc-time');
    const quickFillBtn = modal.querySelector('#quick-fill-btn');
    const closeBtn = modal.querySelector('#close-login-btn');

    closeBtn.addEventListener('click', () => {
      window.location.href = '?view=public';
    });

    quickFillBtn.addEventListener('click', () => {
      passInput.value = 'admin123';
      passInput.focus();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorMsg.textContent = '';
      submitBtn.disabled = true;
      spinner.style.display = 'inline-block';
      calcTime.textContent = 'Computing Argon2id...';
      calcTime.style.color = 'var(--warning)';

      try {
        const res = await this.login(passInput.value);
        if (res.success) {
          calcTime.textContent = `Verified in ${res.computeTime}ms`;
          calcTime.style.color = 'var(--success)';
          modal.classList.add('animate-fade-out');
          setTimeout(() => {
            modal.remove();
            if (typeof onSuccess === 'function') onSuccess();
          }, 200);
        } else {
          calcTime.textContent = `Failed (${res.computeTime}ms)`;
          calcTime.style.color = 'var(--danger)';
          errorMsg.textContent = res.error || 'Incorrect password.';
          modal.querySelector('.modal-box').classList.add('animate-shake');
          setTimeout(() => {
            modal.querySelector('.modal-box').classList.remove('animate-shake');
          }, 500);
        }
      } catch (err) {
        errorMsg.textContent = `Verification error: ${err.message}`;
      } finally {
        submitBtn.disabled = false;
        spinner.style.display = 'none';
      }
    });
  }
}

export const auth = new Argon2Auth();
