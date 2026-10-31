// ══════════════════════════════════════════
//  SHADOWVAULT — VAULT.JS
//  Password Vault + Generator + Health Check
// ══════════════════════════════════════════

const VAULT_STORAGE_KEY = 'shadowvault.encryptedVault.v1';
const VAULT_BACKUP_FORMAT = 'shadowvault-encrypted-backup-v1';

function bytesToBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}

function base64ToBytes(base64) {
    const binary = atob(base64);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

const VaultManager = {

    // ── VAULT STATE ──
    entries: [],
    masterPassword: null,
    isLocked: true,
    clipboardTimer: null,

    async create(password) {
        if (localStorage.getItem(VAULT_STORAGE_KEY)) {
            throw new Error('A vault already exists in this browser. Unlock it or import a backup.');
        }
        this.entries = [];
        this.masterPassword = password;
        this.isLocked = false;
        try {
            await this.persist();
        } catch (error) {
            this.lock();
            throw error;
        }
        this.renderVault();
    },

    async unlock(password) {
        const stored = localStorage.getItem(VAULT_STORAGE_KEY);
        if (!stored) throw new Error('No vault exists in this browser. Create one or import a backup.');

        const decrypted = await CryptoEngine.decrypt(base64ToBytes(stored), password);
        const data = JSON.parse(decrypted);
        const entries = Array.isArray(data) ? data : data.entries;
        if (!Array.isArray(entries)) throw new Error('The saved vault data is invalid.');

        this.entries = entries;
        this.masterPassword = password;
        this.isLocked = false;
        this.renderVault();
    },

    lock() {
        this.entries = [];
        this.masterPassword = null;
        this.isLocked = true;
        this.renderVault();
    },

    async persist() {
        if (this.isLocked || !this.masterPassword) {
            throw new Error('Unlock the vault before changing entries.');
        }
        const encrypted = await CryptoEngine.encrypt(this.serialize(), this.masterPassword);
        localStorage.setItem(VAULT_STORAGE_KEY, bytesToBase64(encrypted));
    },

    // ── ADD ENTRY ──
    async addEntry(site, username, password, notes = '') {
        const entry = {
            id: Date.now(),
            site: site.trim(),
            user: username.trim(),
            pwd: password,
            notes: notes.trim(),
            created: Date.now(),
            // Expiry = 90 days from now
            expires: Date.now() + (90 * 24 * 60 * 60 * 1000)
        };
        this.entries.push(entry);
        try {
            await this.persist();
        } catch (error) {
            this.entries.pop();
            throw error;
        }
        this.renderVault();
        return entry;
    },

    // ── DELETE ENTRY ──
    async deleteEntry(id) {
        const previous = this.entries;
        this.entries = this.entries.filter(e => e.id !== id);
        try {
            await this.persist();
        } catch (error) {
            this.entries = previous;
            showStatus('vaultStatus', 'error', 'Could not save vault changes.');
            return;
        }
        this.renderVault();
    },

    // ── UPDATE ENTRY ──
    async updateEntry(id, updates) {
        const idx = this.entries.findIndex(e => e.id === id);
        if (idx !== -1) {
            const previous = this.entries[idx];
            this.entries[idx] = { ...this.entries[idx], ...updates };
            try {
                await this.persist();
            } catch (error) {
                this.entries[idx] = previous;
                showStatus('vaultStatus', 'error', 'Could not save vault changes.');
                return;
            }
            this.renderVault();
        }
    },

    // ── SEARCH ENTRIES ──
    search(query) {
        if (!query) return this.entries;
        const q = query.toLowerCase();
        return this.entries.filter(e =>
            e.site.toLowerCase().includes(q) ||
            e.user.toLowerCase().includes(q) ||
            e.notes.toLowerCase().includes(q)
        );
    },

    // ── RENDER VAULT TABLE ──
    renderVault(filter = '') {
        const container = document.getElementById('vaultEntries');
        const emptyMsg  = document.getElementById('vaultEmpty');
        if (!container) return;

        const entries = filter ? this.search(filter) : this.entries;

        if (entries.length === 0) {
            container.innerHTML = '';
            if (emptyMsg) emptyMsg.style.display = 'block';
            return;
        }

        if (emptyMsg) emptyMsg.style.display = 'none';
        container.innerHTML = entries.map(e => {
            const expiry = this._getExpiryStatus(e.expires);
            return `
            <div class="vault-entry-row" id="row-${e.id}">
                <div class="entry-site">${this._escHtml(e.site)}</div>
                <div class="entry-user">${this._escHtml(e.user)}</div>
                <div class="entry-pwd hidden" id="pwd-${e.id}">
                    ••••••••••••
                </div>
                <div class="entry-expiry ${expiry.cls}">
                    ${expiry.label}
                </div>
                <div class="entry-actions">
                    <button class="btn btn-sm btn-outline"
                        onclick="VaultManager.togglePwd(${e.id})"
                        title="Show/Hide">👁</button>
                    <button class="btn btn-sm btn-outline"
                        onclick="VaultManager.copyPwd(${e.id})"
                        title="Copy">📋</button>
                    <button class="btn btn-sm btn-danger"
                        onclick="VaultManager.deleteEntry(${e.id})"
                        title="Delete">✕</button>
                </div>
            </div>`;
        }).join('');
    },

    // ── TOGGLE PASSWORD VISIBILITY ──
    togglePwd(id) {
        const el = document.getElementById('pwd-' + id);
        const entry = this.entries.find(e => e.id === id);
        if (!el || !entry) return;

        if (el.classList.contains('hidden')) {
            el.textContent = entry.pwd;
            el.classList.remove('hidden');
            // Auto hide after 10 seconds
            setTimeout(() => {
                if (el) {
                    el.textContent = '••••••••••••';
                    el.classList.add('hidden');
                }
            }, 10000);
        } else {
            el.textContent = '••••••••••••';
            el.classList.add('hidden');
        }
    },

    // ── COPY PASSWORD WITH AUTO-CLEAR ──
    copyPwd(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return;

        navigator.clipboard.writeText(entry.pwd).then(() => {
            this._showClipToast(30);
        });
    },

    // ── CLIPBOARD TOAST WITH COUNTDOWN ──
    _showClipToast(seconds) {
        const toast    = document.getElementById('clipToast');
        const countdown = document.getElementById('clipCountdown');
        if (!toast) return;

        toast.classList.add('show');
        let remaining = seconds;
        countdown.textContent = remaining;

        // Clear previous timer
        if (this.clipboardTimer) clearInterval(this.clipboardTimer);

        this.clipboardTimer = setInterval(() => {
            remaining--;
            countdown.textContent = remaining;
            if (remaining <= 0) {
                clearInterval(this.clipboardTimer);
                toast.classList.remove('show');
                // Clear clipboard
                navigator.clipboard.writeText('').catch(() => {});
            }
        }, 1000);
    },

    // ── PASSWORD GENERATOR ──
    generate(options = {}) {
        const {
            length   = 20,
            upper    = true,
            lower    = true,
            digits   = true,
            symbols  = true
        } = options;

        let charset = '';
        if (upper)   charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (lower)   charset += 'abcdefghijklmnopqrstuvwxyz';
        if (digits)  charset += '0123456789';
        if (symbols) charset += '!@#$%^&*()-_=+[]{}|;:,.<>?';

        // Fallback if nothing selected
        if (!charset) charset = 'abcdefghijklmnopqrstuvwxyz';

        // Use crypto.getRandomValues for true randomness
        const randomValues = new Uint32Array(length);
        crypto.getRandomValues(randomValues);

        return Array.from(randomValues)
            .map(v => charset[v % charset.length])
            .join('');
    },

    // ── PASSWORD HEALTH CHECK ──
    healthCheck() {
        const issues = [];

        this.entries.forEach(entry => {

            // Check password length
            if (entry.pwd.length < 8) {
                issues.push({
                    id: entry.id,
                    site: entry.site,
                    type: 'weak',
                    message: 'Password too short (< 8 chars)'
                });
            }

            // Check for reused passwords
            const reused = this.entries.filter(
                e => e.id !== entry.id && e.pwd === entry.pwd
            );
            if (reused.length > 0) {
                issues.push({
                    id: entry.id,
                    site: entry.site,
                    type: 'reused',
                    message: `Password reused on ${reused.map(r => r.site).join(', ')}`
                });
            }

            // Check for common weak passwords
            const commonPwds = [
                'password', '123456', 'qwerty',
                'abc123', 'password123', 'admin',
                'letmein', 'welcome', 'monkey'
            ];
            if (commonPwds.includes(entry.pwd.toLowerCase())) {
                issues.push({
                    id: entry.id,
                    site: entry.site,
                    type: 'common',
                    message: 'Password is in common passwords list'
                });
            }

            // Check expiry
            if (entry.expires && entry.expires < Date.now()) {
                issues.push({
                    id: entry.id,
                    site: entry.site,
                    type: 'expired',
                    message: 'Password has expired (> 90 days old)'
                });
            }
        });

        return issues;
    },

    // ── EXPORT ENCRYPTED BACKUP ──
    exportEncryptedBackup() {
        const encrypted = localStorage.getItem(VAULT_STORAGE_KEY);
        if (!encrypted) throw new Error('There is no saved vault to export.');
        const data = JSON.stringify({
            format: VAULT_BACKUP_FORMAT,
            payload: encrypted
        }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'shadowvault_encrypted_backup_' + Date.now() + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    async importEncryptedBackup(jsonString, password) {
        const backup = JSON.parse(jsonString);
        if (backup.format !== VAULT_BACKUP_FORMAT || typeof backup.payload !== 'string') {
            throw new Error('This is not a ShadowVault encrypted backup.');
        }
        const decrypted = await CryptoEngine.decrypt(base64ToBytes(backup.payload), password);
        const data = JSON.parse(decrypted);
        const entries = Array.isArray(data) ? data : data.entries;
        if (!Array.isArray(entries)) throw new Error('The backup data is invalid.');

        localStorage.setItem(VAULT_STORAGE_KEY, backup.payload);
        this.entries = entries;
        this.masterPassword = password;
        this.isLocked = false;
        this.renderVault();
    },

    // ── SERIALIZE VAULT TO STRING (for encryption) ──
    serialize() {
        return JSON.stringify({
            version: '2.4',
            entries: this.entries,
            exported: new Date().toISOString()
        });
    },

    // ── DESERIALIZE VAULT FROM STRING ──
    deserialize(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.entries = data.entries || data;
            this.renderVault();
            return true;
        } catch (e) {
            return false;
        }
    },

    // ── GENERATE STRENGTH LABEL ──
    getStrengthLabel(password) {
        const entropy = this._calcEntropy(password);
        if (entropy < 28)  return { label: 'WEAK',        color: '#ff2244' };
        if (entropy < 36)  return { label: 'FAIR',        color: '#ffcc00' };
        if (entropy < 60)  return { label: 'STRONG',      color: '#00d4ff' };
        if (entropy < 80)  return { label: 'VERY STRONG', color: '#00ff88' };
        return               { label: 'FORTRESS',         color: '#00ff88' };
    },

    // ── CRACK TIME ──
    getCrackTime(password) {
        const entropy = this._calcEntropy(password);
        const ops = Math.pow(2, entropy) / 1e10;
        if (ops < 1)        return 'instant';
        if (ops < 60)       return Math.round(ops) + 's';
        if (ops < 3600)     return Math.round(ops / 60) + 'min';
        if (ops < 86400)    return Math.round(ops / 3600) + 'hrs';
        if (ops < 2592000)  return Math.round(ops / 86400) + 'd';
        if (ops < 31536000) return Math.round(ops / 2592000) + 'mo';
        if (ops < 3.15e9)   return Math.round(ops / 31536000) + 'yr';
        return '∞';
    },

    // ── EXPIRY STATUS ──
    _getExpiryStatus(expires) {
        if (!expires) return { label: 'No expiry', cls: 'expiry-ok' };
        const now  = Date.now();
        const diff = expires - now;
        const days = Math.round(diff / (1000 * 60 * 60 * 24));

        if (days < 0)  return { label: `Expired ${Math.abs(days)}d ago`, cls: 'expiry-expired' };
        if (days < 14) return { label: `Expires in ${days}d`, cls: 'expiry-warn' };
        return           { label: `${days}d left`, cls: 'expiry-ok' };
    },

    // ── PRIVATE: ENTROPY CALC ──
    _calcEntropy(pwd) {
        let cs = 0;
        if (/[a-z]/.test(pwd)) cs += 26;
        if (/[A-Z]/.test(pwd)) cs += 26;
        if (/[0-9]/.test(pwd)) cs += 10;
        if (/[^A-Za-z0-9]/.test(pwd)) cs += 32;
        return Math.round(pwd.length * Math.log2(cs || 1));
    },

    // ── PRIVATE: ESCAPE HTML ──
    _escHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

};