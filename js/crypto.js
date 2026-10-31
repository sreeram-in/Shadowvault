// ══════════════════════════════════════════
//  SHADOWVAULT — CRYPTO.JS
//  AES-256-GCM + PBKDF2 Key Derivation
// ══════════════════════════════════════════

const CryptoEngine = {

    // ── DERIVE KEY FROM PASSWORD ──
    // Password + Salt → 100,000 SHA-256 rounds → 256-bit AES key
    async deriveKey(password, salt, iterations = 100000) {
        const enc = new TextEncoder();

        // Import raw password as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        // Run PBKDF2 → output AES-256 key
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: iterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            true,       // extractable = true (for visualiser)
            ['encrypt', 'decrypt']
        );
    },

    // ── ENCRYPT MESSAGE ──
    // Returns: [4 bytes iterations] + [16 bytes salt] + [12 bytes IV] + [ciphertext+tag]
    async encrypt(message, password, iterations = 100000) {
        const enc = new TextEncoder();

        // Generate random salt and IV
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv   = crypto.getRandomValues(new Uint8Array(12));

        // Derive key
        const key = await this.deriveKey(password, salt, iterations);

        // Encrypt with AES-256-GCM
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            enc.encode(message)
        );

        // Assemble final payload
        // Layout: [iterations:4][salt:16][iv:12][ciphertext+16byte_tag]
        const ct = new Uint8Array(ciphertext);
        const result = new Uint8Array(4 + 16 + 12 + ct.length);
        const view = new DataView(result.buffer);

        view.setUint32(0, iterations);      // bytes 0-3
        result.set(salt, 4);               // bytes 4-19
        result.set(iv, 20);                // bytes 20-31
        result.set(ct, 32);                // bytes 32+

        return result;
    },

    // ── DECRYPT MESSAGE ──
    // Takes encrypted payload + password → original message string
    async decrypt(data, password) {
        const view = new DataView(data.buffer);

        // Extract components from payload
        const iterations = view.getUint32(0);
        const salt       = data.slice(4, 20);
        const iv         = data.slice(20, 32);
        const ciphertext = data.slice(32);

        // Re-derive same key using extracted salt
        const key = await this.deriveKey(password, salt, iterations);

        // Decrypt — throws if wrong password or tampered data
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            ciphertext
        );

        return new TextDecoder().decode(plaintext);
    },

    // ── EXPORT KEY BYTES (for visualiser) ──
    async exportKey(key) {
        const raw = await crypto.subtle.exportKey('raw', key);
        return new Uint8Array(raw);
    },

    // ── GET KEY PARAMS (for visualiser) ──
    async getEncryptionDetails(message, password, iterations = 100000) {
        const enc = new TextEncoder();
        const msgBytes = enc.encode(message);

        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv   = crypto.getRandomValues(new Uint8Array(12));

        const key = await this.deriveKey(password, salt, iterations);
        const keyBytes = await this.exportKey(key);

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            msgBytes
        );
        const ctBytes = new Uint8Array(ciphertext);

        return {
            msgBytes,
            salt,
            iv,
            iterations,
            keyBytes,
            ctBytes,
            totalPayload: 4 + 16 + 12 + ctBytes.length
        };
    },

    // ── PASSWORD STRENGTH CHECKER ──
    checkStrength(password) {
        let score = 0;
        let feedback = '';

        if (password.length >= 8)  score += 20;
        if (password.length >= 12) score += 15;
        if (password.length >= 16) score += 10;
        if (/[A-Z]/.test(password)) score += 15;
        if (/[a-z]/.test(password)) score += 10;
        if (/[0-9]/.test(password)) score += 15;
        if (/[^A-Za-z0-9]/.test(password)) score += 15;

        if (score < 30)      feedback = 'WEAK';
        else if (score < 55) feedback = 'MODERATE';
        else if (score < 75) feedback = 'STRONG';
        else                 feedback = 'FORTRESS';

        const colors = {
            WEAK:     '#ff2244',
            MODERATE: '#ffcc00',
            STRONG:   '#00d4ff',
            FORTRESS: '#00ff88'
        };

        return {
            score,
            label: feedback,
            color: colors[feedback]
        };
    },

    // ── ENTROPY CALCULATOR ──
    calculateEntropy(password) {
        let charsetSize = 0;
        if (/[a-z]/.test(password)) charsetSize += 26;
        if (/[A-Z]/.test(password)) charsetSize += 26;
        if (/[0-9]/.test(password)) charsetSize += 10;
        if (/[^A-Za-z0-9]/.test(password)) charsetSize += 32;
        return Math.round(password.length * Math.log2(charsetSize || 1));
    },

    // ── CRACK TIME ESTIMATOR ──
    estimateCrackTime(entropyBits) {
        // Assume 10 billion guesses/sec (GPU cluster)
        const guessesPerSec = 1e10;
        const seconds = Math.pow(2, entropyBits) / guessesPerSec;

        if (seconds < 1)         return 'Instant';
        if (seconds < 60)        return Math.round(seconds) + ' seconds';
        if (seconds < 3600)      return Math.round(seconds / 60) + ' minutes';
        if (seconds < 86400)     return Math.round(seconds / 3600) + ' hours';
        if (seconds < 2592000)   return Math.round(seconds / 86400) + ' days';
        if (seconds < 31536000)  return Math.round(seconds / 2592000) + ' months';
        if (seconds < 3.15e9)    return Math.round(seconds / 31536000) + ' years';
        return '∞ centuries';
    },

    // ── BYTES TO HEX STRING ──
    toHex(bytes) {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');
    },

    // ── BYTES TO BIT STRING ──
    toBits(bytes) {
        return Array.from(bytes)
            .map(b => b.toString(2).padStart(8, '0'))
            .join(' ');
    }

};
