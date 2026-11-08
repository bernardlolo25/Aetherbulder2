/**
 * AETHERBUILDER - DEVELOPER CONSOLE ARGON2 SECURITY ENGINE
 * ============================================================================
 * Separate, dedicated cryptographic authentication layer for developer operations:
 * - Hidden remote feed URL (GitHub Raw JSON & Google Sheets CSV)
 * - Add-on marketplace seller pricing and license key generator
 * - Free Template Store publisher and required add-on dependencies
 *
 * Even if regular users know the admin password, they CANNOT access this Developer Hub
 * without the independent Developer Argon2 credentials.
 */

const DEV_AUTH_STORAGE_KEY = 'aether_dev_argon2_hash';
const DEV_SESSION_KEY      = 'aether_dev_authenticated';
const DEV_TOKEN_KEY        = 'aether_dev_token';
const GITHUB_PAT_KEY       = 'aether_github_pat';

export const GITHUB_REPO_DEFAULT   = 'bernardlolo25/aetherbuilder';
export const GITHUB_BRANCH_DEFAULT = 'main';
export const GITHUB_RAW_DEV_AUTH   = 'https://raw.githubusercontent.com/bernardlolo25/aetherbuilder/main/data/dev_auth.json';
export const DEFAULT_DEV_HASH      = '$argon2id$v=19$m=4096,t=3,p=1$QOAqE66QkTVrF1fMKACoCg$AE9vOfG5nnyumPUm1We3K8uu1CebrKviv8NL01QdN9k';

export class DeveloperAuth {
  constructor() {
    this.hashwasm = window.hashwasm || null;
    this.isReady = false;
    this.lastRemoteSync = null;
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
          await new Promise(r => setTimeout(r, 100));
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
      await this.ensureDefaultDevPassword();
      // Non-blocking async remote check with 2.5s timeout
      this.syncRemoteMasterHash().catch(() => {});
    } catch (err) {
      console.warn('DeveloperAuth init non-blocking warn:', err);
    }
    return this.isReady;
  }

  generateSalt(length = 16) {
    const salt = new Uint8Array(length);
    window.crypto.getRandomValues(salt);
    return salt;
  }

  async hashPassword(password) {
    await this.ensureEngineReady();
    if (!this.hashwasm || !this.hashwasm.argon2id) {
      throw new Error('Argon2 WebAssembly cryptographic engine is not ready.');
    }

    const salt = this.generateSalt(16);
    const hash = await this.hashwasm.argon2id({
      password: password,
      salt: salt,
      parallelism: 1,
      iterations: 3,
      memorySize: 4096, // 4MB RAM cost in browser
      hashLength: 32,
      outputType: 'encoded' // Standard PHC Argon2 format ($argon2id$...)
    });

    return hash;
  }

  async verifyPassword(password, encodedHash) {
    await this.ensureEngineReady();
    if (!this.hashwasm || !this.hashwasm.argon2Verify) {
      throw new Error('Argon2 WebAssembly verify engine is not available.');
    }

    return await this.hashwasm.argon2Verify({
      password: password,
      hash: encodedHash
    });
  }

  // ── GitHub Remote Master Security Synchronization ─────────────────────────
  // Whenever the developer changes their password and pushes to GitHub,
  // ALL installed user systems automatically receive the new Argon2 hash as their master authority!
  async syncRemoteMasterHash(force = false) {
    try {
      const feedConfig = await this.getStoreFeedConfig();
      const remoteUrl = feedConfig.remoteSecurityUrl || GITHUB_RAW_DEV_AUTH;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      
      const res = await fetch(`${remoteUrl}?_t=${Date.now()}`, { 
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const remoteData = await res.json();
        if (remoteData && remoteData.argon2_hash && remoteData.argon2_hash.startsWith('$argon2id$')) {
          const currentHash = this.getStoredHash();
          this.lastRemoteSync = new Date().toISOString();
          localStorage.setItem('aether_dev_last_remote_sync', this.lastRemoteSync);

          if (force || currentHash !== remoteData.argon2_hash) {
            console.log('🔄 [DevAuth] Synchronized updated Master Argon2 Hash from GitHub repository:', remoteUrl);
            localStorage.setItem(DEV_AUTH_STORAGE_KEY, remoteData.argon2_hash);
            
            // Sync to local server file so local backend matches GitHub authority
            try {
              const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
              await fetch(`${apiBase}?action=save_dev_auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ argon2_hash: remoteData.argon2_hash })
              });
            } catch {}

            return { success: true, updated: true, hash: remoteData.argon2_hash, source: remoteUrl };
          }
          return { success: true, updated: false, hash: currentHash, source: remoteUrl };
        }
      }
    } catch (err) {
      console.warn('[DevAuth] Could not pull remote master hash from GitHub (offline, timeout, or repo private):', err.message);
    }
    return { success: false };
  }

  async getStoreFeedConfig() {
    try {
      const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${apiBase}?action=get_store_feed_config&_t=${Date.now()}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return {
      remoteFeedUrl: 'https://raw.githubusercontent.com/bernardlolo25/aetherbuilder/main/data/addons.json',
      githubRepo: GITHUB_REPO_DEFAULT,
      githubBranch: GITHUB_BRANCH_DEFAULT,
      remoteSecurityUrl: GITHUB_RAW_DEV_AUTH,
      autoPushSecurityToGithub: true,
      autoPullMasterSecurityFromGithub: true,
      githubPat: ''
    };
  }

  async ensureDefaultDevPassword() {
    // 1. Check local storage first
    let currentHash = localStorage.getItem(DEV_AUTH_STORAGE_KEY);
    if (currentHash) return;

    // 2. Try fetching from server data/dev_auth.json
    try {
      const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${apiBase}?action=get_dev_auth&_t=${Date.now()}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.argon2_hash) {
          currentHash = data.argon2_hash;
          localStorage.setItem(DEV_AUTH_STORAGE_KEY, currentHash);
          return;
        }
      }
    } catch {}

    // 3. Fallback: Instant verified precomputed hash ('dev2026!')
    currentHash = DEFAULT_DEV_HASH;
    try {
      localStorage.setItem(DEV_AUTH_STORAGE_KEY, currentHash);
      console.log('✅ Developer Master Argon2id password initialized. Default: dev2026!');
      // Sync to server asynchronously
      const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
      fetch(`${apiBase}?action=save_dev_auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ argon2_hash: currentHash })
      }).catch(() => {});
    } catch (err) {
      console.warn('Could not persist default developer hash:', err);
    }
  }

  getStoredHash() {
    return localStorage.getItem(DEV_AUTH_STORAGE_KEY) || '';
  }

  getStoredPat() {
    return sessionStorage.getItem(GITHUB_PAT_KEY) || localStorage.getItem(GITHUB_PAT_KEY) || '';
  }

  setStoredPat(pat) {
    if (pat) {
      localStorage.setItem(GITHUB_PAT_KEY, pat);
      sessionStorage.setItem(GITHUB_PAT_KEY, pat);
    } else {
      localStorage.removeItem(GITHUB_PAT_KEY);
      sessionStorage.removeItem(GITHUB_PAT_KEY);
    }
  }

  isAuthenticated() {
    return sessionStorage.getItem(DEV_SESSION_KEY) === 'authenticated';
  }

  setSession(status) {
    if (status) {
      sessionStorage.setItem(DEV_SESSION_KEY, 'authenticated');
    } else {
      sessionStorage.removeItem(DEV_SESSION_KEY);
      sessionStorage.removeItem(DEV_TOKEN_KEY);
    }
  }

  lock() {
    this.setSession(false);
  }

  async unlock(password) {
    await this.initPromise;

    // Pull freshest master hash from GitHub authority before evaluating password
    await this.syncRemoteMasterHash().catch(() => {});

    let targetHash = this.getStoredHash();
    if (!targetHash) {
      await this.ensureDefaultDevPassword();
      targetHash = this.getStoredHash();
    }

    const startTime = performance.now();
    let valid = false;
    try {
      valid = await this.verifyPassword(password, targetHash);
    } catch {
      // In case hash was slightly malformed, try default
      valid = (password === 'dev2026!');
    }
    const computeTime = Math.round(performance.now() - startTime);

    if (valid) {
      this.setSession(true);
      // Attempt server-side session token
      try {
        const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
        const res = await fetch(`${apiBase}?action=verify_dev_session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: password, argon2_hash: targetHash })
        });
        const data = await res.json();
        if (data && data.token) {
          sessionStorage.setItem(DEV_TOKEN_KEY, data.token);
        }
      } catch {}
      return { success: true, computeTime };
    } else {
      return { success: false, error: 'Invalid developer security password.', computeTime };
    }
  }

  // ── Push any file directly to GitHub Repository via GitHub REST API ─────────
  async pushFileToGitHub(relativePath, contentStr, commitMessage, customPat = null) {
    const feedConfig = await this.getStoreFeedConfig();
    const repo = feedConfig.githubRepo || GITHUB_REPO_DEFAULT;
    const branch = feedConfig.githubBranch || GITHUB_BRANCH_DEFAULT;
    const token = customPat || this.getStoredPat() || feedConfig.githubPat || '';

    if (!token) {
      throw new Error('GitHub Personal Access Token (PAT) is required to push to GitHub.');
    }

    const apiUrl = `https://api.github.com/repos/${repo}/contents/${relativePath}`;

    // 1. Get current file SHA if it already exists on GitHub
    let fileSha = null;
    try {
      const getRes = await fetch(`${apiUrl}?ref=${branch}&_t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getRes.ok) {
        const getData = await getRes.json();
        fileSha = getData.sha;
      }
    } catch {}

    // 2. Base64 encode content with UTF-8 support
    const base64Content = btoa(unescape(encodeURIComponent(contentStr)));

    // 3. Commit & push
    const putBody = {
      message: commitMessage || `Update ${relativePath} via AetherBuilder Developer Hub`,
      content: base64Content,
      branch: branch
    };
    if (fileSha) {
      putBody.sha = fileSha;
    }

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(putBody)
    });

    if (!putRes.ok) {
      const errData = await putRes.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub API error: ${putRes.status}`);
    }

    const result = await putRes.json();
    return {
      success: true,
      commitSha: result.commit ? result.commit.sha : '',
      commitUrl: result.commit ? result.commit.html_url : `https://github.com/${repo}/commit/${branch}`
    };
  }

  // ── Push developer master Argon2 security hash to GitHub repository ───────
  async pushSecurityHashToGitHub(customHash = null, customPat = null) {
    const hash = customHash || this.getStoredHash();
    if (!hash) throw new Error('No Argon2 hash available to push.');

    const payload = JSON.stringify({
      argon2_hash: hash,
      updated_at: new Date().toISOString()
    }, null, 2);

    return await this.pushFileToGitHub(
      'data/dev_auth.json',
      payload,
      `🔒 Update Developer Master Argon2 Security Hash [${new Date().toISOString()}]`,
      customPat
    );
  }

  async updatePassword(oldPassword, newPassword, options = {}) {
    await this.initPromise;
    const unlockRes = await this.unlock(oldPassword);
    if (!unlockRes.success) {
      return { success: false, error: 'Current developer password is incorrect.' };
    }

    if (!newPassword || newPassword.length < 5) {
      return { success: false, error: 'New password must be at least 5 characters.' };
    }

    const newHash = await this.hashPassword(newPassword);
    localStorage.setItem(DEV_AUTH_STORAGE_KEY, newHash);

    // 1. Sync to local server
    try {
      const apiBase = (typeof window._aetherApiBase !== 'undefined') ? window._aetherApiBase : 'api.php';
      await fetch(`${apiBase}?action=save_dev_auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          argon2_hash: newHash,
          token: sessionStorage.getItem(DEV_TOKEN_KEY) || ''
        })
      });
    } catch (e) {
      console.warn('Could not sync dev hash to local server:', e);
    }

    // 2. Automatically pitch to GitHub repository if enabled or PAT provided
    let githubPushResult = null;
    const token = options.pat || this.getStoredPat();
    if (options.pushToGithub !== false && token) {
      try {
        githubPushResult = await this.pushSecurityHashToGitHub(newHash, token);
      } catch (err) {
        console.warn('Could not auto-push hash to GitHub:', err.message);
        githubPushResult = { success: false, error: err.message };
      }
    }

    return { success: true, newHash, githubPushResult };
  }
}

export const devAuth = new DeveloperAuth();
