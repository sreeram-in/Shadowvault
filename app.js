// ══════════════════════════════════════════
//  SHADOWVAULT — APP.JS
//  Main app logic, UI, boot, panic, matrix
// ══════════════════════════════════════════

// ── STATE ──
let carrierImageData = null;
let carrierCanvas    = null;
let outputImageData  = null;
let idleTimer        = null;
let panicEscCount    = 0;
let panicEscTimer    = null;
let isLightMode      = false;
let matrixActive     = false;
let matrixTimer      = null;
let matrixAnimId     = null;
let tabHidden        = false;
let blurActive       = false;

// ══════════════════════════════════════════
//  BOOT SEQUENCE
// ══════════════════════════════════════════
(function initBoot() {
    const bar      = document.getElementById('bootBar');
    const log      = document.getElementById('bootLog');
    const messages = [
        '[ OK ] Initializing cryptographic modules...',
        '[ OK ] Loading AES-256-GCM engine...',
        '[ OK ] PBKDF2 key derivation ready...',
        '[ OK ] LSB steganography engine online...',
        '[ OK ] Secure vault manager loaded...',
        '[ OK ] Panic system armed...',
        '[ .. ] Establishing secure session...',
        '[ OK ] SHADOWVAULT OPERATIVE SYSTEM READY.'
    ];

    let progress = 0;
    let msgIndex = 0;

    const msgInterval = setInterval(() => {
        if (msgIndex < messages.length) {
            const line = document.createElement('div');
            line.textContent = messages[msgIndex];
            line.style.color = messages[msgIndex].includes('OK')
                ? '#00aa88' : '#00d4ff';
            log.appendChild(line);
            msgIndex++;
        }
    }, 200);

    const barInterval = setInterval(() => {
        progress += Math.random() * 12;
        if (progress >= 100) {
            progress = 100;
            clearInterval(barInterval);
            clearInterval(msgInterval);
            setTimeout(finishBoot, 300);
        }
        if (bar) bar.style.width = progress + '%';
    }, 100);

    function finishBoot() {
        const screen = document.getElementById('bootScreen');
        if (!screen) { initApp(); return; }
        screen.style.transition = 'opacity 0.7s';
        screen.style.opacity    = '0';
        setTimeout(() => {
            screen.style.display = 'none';
            startTerminalAnim();
            initApp();
        }, 700);
    }
})();

// ══════════════════════════════════════════
//  INIT APP
// ══════════════════════════════════════════
function initApp() {
    // Clock
    updateClock();
    setInterval(updateClock, 1000);

    updateVaultLockView(false);

    // Intel tab
    buildArchDiagram();
    buildSetupGuide();
    buildCodeTabs();
    showCode('crypto');

    // Drag and drop
    setupDragDrop('encDropZone', 'encImgInput', handleEncImage);
    setupDragDrop('decDropZone', 'decImgInput', handleDecImage);

    // Idle lock — reset on any activity
    resetIdleTimer();
    ['mousemove', 'keypress', 'click', 'scroll', 'touchstart']
        .forEach(evt => document.addEventListener(evt, resetIdleTimer));

    // Panic key (ESC x2)
    document.addEventListener('keydown', handleKeyDown);

    // ── TAB VISIBILITY / BLUR PROTECTION ──
    setupVisibilityProtection();

    // Matrix idle
    resetMatrixTimer();

    // Inject blur overlay into DOM if not present
    injectBlurOverlay();
}

// ══════════════════════════════════════════
//  INJECT BLUR OVERLAY
// ══════════════════════════════════════════
function injectBlurOverlay() {
    if (document.getElementById('blurOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'blurOverlay';
    overlay.innerHTML = `
    <div style="text-align:center;">
        <div style="
            font-family:'Orbitron',sans-serif;
            font-size:28px;
            color:#00d4ff;
            letter-spacing:0.2em;
            margin-bottom:16px;
            text-shadow:0 0 20px #00d4ff;
        ">⚠ SESSION HIDDEN</div>
        <div style="
            font-family:'Share Tech Mono',monospace;
            font-size:14px;
            color:#4a7a9b;
            margin-bottom:24px;
            letter-spacing:0.1em;
        ">SCREEN PROTECTED — TAB SWITCH DETECTED</div>
        <button onclick="dismissBlur()" style="
            background:transparent;
            border:1px solid #00d4ff;
            color:#00d4ff;
            font-family:'Orbitron',sans-serif;
            font-size:12px;
            letter-spacing:0.15em;
            padding:10px 28px;
            cursor:pointer;
            transition:all 0.3s;
        "
        onmouseover="this.style.background='rgba(0,212,255,0.1)'"
        onmouseout="this.style.background='transparent'"
        >▶ RESUME SESSION</button>
    </div>`;

    overlay.style.cssText = `
        display: none;
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(2, 5, 8, 0.97);
        z-index: 99998;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
    `;

    document.body.appendChild(overlay);
}

// ══════════════════════════════════════════
//  TAB VISIBILITY PROTECTION
// ══════════════════════════════════════════
function setupVisibilityProtection() {

    // Method 1: visibilitychange (most reliable)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            activateBlur('Tab switch detected');
        } else {
            // Small delay so overlay shows briefly on return
            setTimeout(() => {
                // Don't auto-dismiss — require user click
            }, 100);
        }
    });

    // Method 2: window blur (catches alt-tab, window switch)
    window.addEventListener('blur', () => {
        activateBlur('Window lost focus');
    });

    // Method 3: page hide (tab close / navigate away)
    window.addEventListener('pagehide', () => {
        clearSensitiveData();
    });

    // Method 4: before unload
    window.addEventListener('beforeunload', () => {
        clearSensitiveData();
    });

    // Method 5: focus return — show overlay, require click
    window.addEventListener('focus', () => {
        // Overlay stays visible until user clicks Resume
        // This forces them to acknowledge the interruption
    });
}

// ── ACTIVATE BLUR ──
function activateBlur(reason) {
    blurActive = true;
    lockPasswordVault();
    clearSensitiveData();

    const overlay = document.getElementById('blurOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }

    // Also blur the body behind overlay
    document.body.style.filter = 'blur(12px)';

    console.log('[SHADOWVAULT] Screen protected:', reason);
}

// ── DISMISS BLUR ──
function dismissBlur() {
    blurActive = false;

    const overlay = document.getElementById('blurOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }

    document.body.style.filter = 'none';
    resetIdleTimer();
}

// ══════════════════════════════════════════
//  CLOCK
// ══════════════════════════════════════════
function updateClock() {
    const el = document.getElementById('clock');
    if (el) {
        el.textContent = new Date()
            .toISOString()
            .replace('T', ' ')
            .slice(0, 19) + ' UTC';
    }
}

// ══════════════════════════════════════════
//  TERMINAL ANIMATION
// ══════════════════════════════════════════
function startTerminalAnim() {
    [1, 2, 3, 4, 5].forEach((i, idx) => {
        setTimeout(() => {
            const el = document.getElementById('t' + i);
            if (el) el.classList.add('show');
        }, idx * 400);
    });
}

// ══════════════════════════════════════════
//  TAB SWITCHING
// ══════════════════════════════════════════
function switchTab(name) {
    document.querySelectorAll('.tab-content')
        .forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-tab')
        .forEach(t => t.classList.remove('active'));

    const tab = document.getElementById('tab-' + name);
    if (tab) tab.classList.add('active');

    const tabs = [
        'terminal', 'encode', 'decode',
        'visualiser', 'vault', 'intel'
    ];
    const idx = tabs.indexOf(name);
    const navTabs = document.querySelectorAll('.nav-tab');
    if (navTabs[idx]) navTabs[idx].classList.add('active');

    resetMatrixTimer();
}

// ══════════════════════════════════════════
//  THEME TOGGLE
// ══════════════════════════════════════════
function toggleTheme() {
    isLightMode = !isLightMode;
    document.body.classList.toggle('light', isLightMode);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = isLightMode ? '🌙' : '☀️';
}

// ══════════════════════════════════════════
//  PANIC BUTTON
// ══════════════════════════════════════════
function triggerPanic() {
    const overlay = document.getElementById('panicOverlay');
    if (overlay) overlay.classList.add('active');
    lockPasswordVault();
    clearSensitiveData();
    stopMatrix();
}

function handleKeyDown(e) {
    if (e.key === 'Escape') {
        const panicOverlay =
            document.getElementById('panicOverlay');
        const blurOverlay =
            document.getElementById('blurOverlay');

        // ESC dismisses blur overlay
        if (blurOverlay &&
            blurOverlay.style.display === 'flex') {
            dismissBlur();
            return;
        }

        // ESC dismisses panic overlay
        if (panicOverlay &&
            panicOverlay.classList.contains('active')) {
            panicOverlay.classList.remove('active');
            panicEscCount = 0;
            return;
        }

        // Double ESC triggers panic
        panicEscCount++;
        if (panicEscTimer) clearTimeout(panicEscTimer);

        if (panicEscCount >= 2) {
            triggerPanic();
            panicEscCount = 0;
        } else {
            panicEscTimer = setTimeout(() => {
                panicEscCount = 0;
            }, 800);
        }
    }
}

function clearSensitiveData() {
    // Clear all password fields
    document.querySelectorAll(
        'input[type="password"]'
    ).forEach(el => el.value = '');

    // Clear message textarea
    const msg = document.getElementById('secretMsg');
    if (msg) msg.value = '';

    // Clear decode result
    const result = document.getElementById('decodeResult');
    if (result) {
        result.textContent = '';
        result.classList.remove('show');
    }

    // Hide vault passwords
    document.querySelectorAll('.entry-pwd')
        .forEach(el => {
            el.textContent = '••••••••••••';
            el.classList.add('hidden');
        });

    // Clear clipboard
    if (navigator.clipboard) {
        navigator.clipboard.writeText('').catch(() => {});
    }
}

// ══════════════════════════════════════════
//  IDLE AUTO-LOCK
// ══════════════════════════════════════════
function resetIdleTimer() {
    clearTimeout(idleTimer);
    resetMatrixTimer();

    idleTimer = setTimeout(() => {
        // Show idle lock overlay
        const lock = document.getElementById('idleLock');
        if (lock) lock.classList.add('active');
        lockPasswordVault();
        clearSensitiveData();
    }, 5 * 60 * 1000); // 5 minutes
}

function unlockVault() {
    const lock = document.getElementById('idleLock');
    if (lock) lock.classList.remove('active');
    resetIdleTimer();
}

function updateVaultLockView(isUnlocked) {
    const lockPanel = document.getElementById('vaultLockPanel');
    const workspace = document.getElementById('vaultWorkspace');
    const controls = document.getElementById('vaultControls');
    if (lockPanel) lockPanel.style.display = isUnlocked ? 'none' : 'block';
    if (workspace) workspace.style.display = isUnlocked ? 'block' : 'none';
    if (controls) controls.style.display = isUnlocked ? 'flex' : 'none';
}

async function createPasswordVault() {
    const input = document.getElementById('vaultMasterPassword');
    const password = input.value;
    if (password.length < 12) {
        return showStatus('vaultAuthStatus', 'error', 'Use a master password with at least 12 characters.');
    }
    try {
        await VaultManager.create(password);
        updateVaultLockView(true);
        input.value = '';
        showStatus('vaultStatus', 'success', 'Encrypted vault created in this browser.');
    } catch (error) {
        showStatus('vaultAuthStatus', 'error', error.message);
    }
}

async function openPasswordVault() {
    const input = document.getElementById('vaultMasterPassword');
    try {
        await VaultManager.unlock(input.value);
        updateVaultLockView(true);
        input.value = '';
        showStatus('vaultStatus', 'success', 'Vault unlocked.');
    } catch (error) {
        showStatus('vaultAuthStatus', 'error', 'Could not unlock vault. Check the password or import a backup.');
    }
}

function lockPasswordVault() {
    VaultManager.lock();
    updateVaultLockView(false);
    ['vaultMasterPassword', 'entrySite', 'entryUser', 'entryPwd', 'entryNotes']
        .forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
    const addPanel = document.getElementById('addEntryPanel');
    if (addPanel) addPanel.style.display = 'none';
}

async function importVaultBackup(file) {
    if (!file) return;
    const input = document.getElementById('vaultMasterPassword');
    try {
        await VaultManager.importEncryptedBackup(await file.text(), input.value);
        updateVaultLockView(true);
        input.value = '';
        showStatus('vaultStatus', 'success', 'Encrypted backup imported and unlocked.');
    } catch (error) {
        showStatus('vaultAuthStatus', 'error', 'Could not import backup. Check the file and master password.');
    } finally {
        document.getElementById('vaultBackupInput').value = '';
    }
}

// ══════════════════════════════════════════
//  MATRIX RAIN
// ══════════════════════════════════════════
function resetMatrixTimer() {
    clearTimeout(matrixTimer);
    stopMatrix();
    matrixTimer = setTimeout(startMatrix, 60 * 1000);
}

function startMatrix() {
    if (matrixActive) return;
    matrixActive = true;

    const canvas = document.getElementById('matrixCanvas');
    if (!canvas) return;

    canvas.classList.add('active');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx   = canvas.getContext('2d');
    const cols  = Math.floor(canvas.width / 14);
    const drops = new Array(cols).fill(1);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';

    function drawMatrix() {
        if (!matrixActive) return;

        ctx.fillStyle = 'rgba(2,5,8,0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#00d4ff';
        ctx.font      = '12px Share Tech Mono';

        drops.forEach((y, i) => {
            const char = chars[
                Math.floor(Math.random() * chars.length)
            ];
            ctx.fillText(char, i * 14, y * 14);

            if (y * 14 > canvas.height &&
                Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        });

        matrixAnimId = requestAnimationFrame(drawMatrix);
    }

    drawMatrix();
}

function stopMatrix() {
    matrixActive = false;
    if (matrixAnimId) {
        cancelAnimationFrame(matrixAnimId);
        matrixAnimId = null;
    }
    const canvas = document.getElementById('matrixCanvas');
    if (canvas) {
        canvas.classList.remove('active');
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(
            0, 0, canvas.width, canvas.height
        );
    }
}

// ══════════════════════════════════════════
//  DRAG AND DROP
// ══════════════════════════════════════════
function setupDragDrop(zoneId, inputId, handler) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;

    zone.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handler(file);
    });

    // Click to browse
    zone.addEventListener('click', () => {
        const input = document.getElementById(inputId);
        if (input) input.click();
    });

    const input = document.getElementById(inputId);
    if (input) {
        input.addEventListener('change', e => {
            const file = e.target.files[0];
            e.target.value = '';
            if (file) handler(file);
        });
    }
}

// ══════════════════════════════════════════
//  HANDLE ENCODE IMAGE
// ══════════════════════════════════════════
function handleEncImage(file) {
    carrierImageData = null;
    carrierCanvas = null;
    outputImageData = null;
    const outputPanel = document.getElementById('downloadPanel');
    if (outputPanel) outputPanel.style.display = 'none';

    StegoEngine.loadImageFile(file)
        .then(({ imageData, canvas }) => {
            if (imageData.data.some((value, index) =>
                index % 4 === 3 && value !== 255)) {
                throw new Error('Use a fully opaque carrier image. Transparent pixels can corrupt hidden data.');
            }

            carrierImageData = imageData;
            carrierCanvas    = canvas;

            const preview = document.getElementById('encPreview');
            if (preview) {
                preview.src           = canvas.toDataURL();
                preview.style.display = 'block';
            }

            const cap = StegoEngine.getCapacity(
                canvas.width, canvas.height
            );
            const capLabel =
                document.getElementById('capacityLabel');
            if (capLabel) {
                capLabel.textContent =
                    `${canvas.width}×${canvas.height} ` +
                    `| Max: ${cap} bytes`;
            }

            updateCapacity();
        })
        .catch(error => {
            const preview = document.getElementById('encPreview');
            if (preview) preview.style.display = 'none';
            showStatus('encStatus', 'error',
            '✗ ' + (error.message || 'Failed to load image'));
        });
}

// ══════════════════════════════════════════
//  HANDLE DECODE IMAGE
// ══════════════════════════════════════════
function handleDecImage(file) {
    const result = document.getElementById('decodeResult');
    const tag = document.getElementById('verifyTag');
    if (result) {
        result.textContent = '';
        result.classList.remove('show');
    }
    if (tag) tag.textContent = '';
    const oldCanvas = document.getElementById('decCanvas');
    if (oldCanvas) {
        oldCanvas.width = 0;
        oldCanvas.height = 0;
    }

    StegoEngine.loadImageFile(file)
        .then(({ imageData, canvas }) => {
            const preview =
                document.getElementById('decPreview');
            if (preview) {
                preview.src           = canvas.toDataURL();
                preview.style.display = 'block';
            }

            // Store in hidden canvas for decoding
            let decCanvas =
                document.getElementById('decCanvas');
            if (!decCanvas) {
                decCanvas = document.createElement('canvas');
                decCanvas.id     = 'decCanvas';
                decCanvas.style.display = 'none';
                document.body.appendChild(decCanvas);
            }
            decCanvas.width  = canvas.width;
            decCanvas.height = canvas.height;
            decCanvas.getContext('2d')
                .putImageData(imageData, 0, 0);
        })
        .catch(() => {
            const preview = document.getElementById('decPreview');
            if (preview) preview.style.display = 'none';
            showStatus('decStatus', 'error',
                '✗ Failed to load image');
        });
}

// ══════════════════════════════════════════
//  UPDATE CAPACITY METER
// ══════════════════════════════════════════
function updateCapacity() {
    if (!carrierCanvas) return;

    const msgEl = document.getElementById('secretMsg');
    const msg   = msgEl ? msgEl.value : '';
    const total = new TextEncoder().encode(msg).length + 50;

    const pct = StegoEngine.getCapacityPercent(
        carrierCanvas.width,
        carrierCanvas.height,
        total
    );

    const bar    = document.getElementById('capBar');
    const capPct = document.getElementById('capPct');
    if (bar)    bar.style.width       = pct + '%';
    if (capPct) capPct.textContent    = pct + '%';

    if (bar) {
        if (pct > 80) {
            bar.style.background = 'var(--red)';
        } else if (pct > 60) {
            bar.style.background = 'var(--gold)';
        } else {
            bar.style.background =
                'linear-gradient(90deg,var(--green),var(--cyan))';
        }
    }
}

// ══════════════════════════════════════════
//  ENCODE MESSAGE
// ══════════════════════════════════════════
async function encodeMessage() {
    const msg  = document.getElementById('secretMsg').value;
    const pwd  = document.getElementById('encPassword').value;
    const pwd2 = document.getElementById('encPasswordConfirm').value;
    const iter = parseInt(
        document.getElementById('iterSlider').value
    );

    if (!carrierImageData) {
        return showStatus('encStatus', 'error',
            '✗ Upload a carrier image first');
    }
    if (!msg.trim()) {
        return showStatus('encStatus', 'error',
            '✗ Enter a secret message');
    }
    if (!pwd) {
        return showStatus('encStatus', 'error',
            '✗ Enter a master password');
    }
    if (pwd !== pwd2) {
        return showStatus('encStatus', 'error',
            '✗ Passwords do not match');
    }

    showStatus('encStatus', 'info',
        '<span class="loader"></span> Encrypting...');

    try {
        const encrypted = await CryptoEngine.encrypt(
            msg, pwd, iter
        );

        const newData = StegoEngine.encode(
            carrierImageData, encrypted
        );
        outputImageData = newData;

        const outCanvas =
            document.getElementById('outputCanvas');
        if (outCanvas) {
            outCanvas.width  = carrierCanvas.width;
            outCanvas.height = carrierCanvas.height;
            outCanvas.getContext('2d')
                .putImageData(newData, 0, 0);
        }

        const dlPanel =
            document.getElementById('downloadPanel');
        if (dlPanel) dlPanel.style.display = 'block';

        const stats =
            document.getElementById('outputStats');
        if (stats) {
            stats.textContent =
                `✓ ${encrypted.length} bytes hidden | ` +
                `${carrierCanvas.width}×` +
                `${carrierCanvas.height}px`;
        }

        showStatus('encStatus', 'success',
            `✓ ${encrypted.length} encrypted bytes ` +
            `hidden in image`);

    } catch (e) {
        showStatus('encStatus', 'error',
            '✗ ' + e.message);
    }
}

// ══════════════════════════════════════════
//  DOWNLOAD OUTPUT IMAGE
// ══════════════════════════════════════════
function downloadOutput() {
    const canvas = document.getElementById('outputCanvas');
    if (!canvas) return;
    const link    = document.createElement('a');
    link.download = 'shadowvault_' + Date.now() + '.png';
    link.href     = canvas.toDataURL('image/png');
    link.click();
}

// ══════════════════════════════════════════
//  DECODE MESSAGE
// ══════════════════════════════════════════
async function decodeMessage() {
    const pwd    = document.getElementById('decPassword').value;
    const canvas = document.getElementById('decCanvas');
    const result = document.getElementById('decodeResult');
    const tag = document.getElementById('verifyTag');

    if (result) {
        result.textContent = '';
        result.classList.remove('show');
    }
    if (tag) tag.textContent = '';

    if (!canvas || !canvas.width) {
        return showStatus('decStatus', 'error',
            '✗ Upload an encoded image first');
    }
    if (!pwd) {
        return showStatus('decStatus', 'error',
            '✗ Enter the master password');
    }

    showStatus('decStatus', 'info',
        '<span class="loader"></span> Decrypting...');

    const pipe = document.getElementById('decodePipeline');
    if (pipe) {
        pipe.innerHTML =
            `<div style="color:var(--cyan)">
                ▶ Reading pixel LSBs...
            </div>`;
    }

    try {
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(
            0, 0, canvas.width, canvas.height
        );

        const extracted = StegoEngine.decode(imgData);

        if (pipe) {
            pipe.innerHTML +=
                `<div style="color:var(--cyan)">
                    ▶ Extracted ${extracted.length} bytes
                </div>
                <div style="color:var(--dim)">
                    ▶ Re-deriving AES key via PBKDF2...
                </div>`;
        }

        const decrypted = await CryptoEngine.decrypt(
            extracted, pwd
        );

        if (pipe) {
            pipe.innerHTML +=
                `<div style="color:var(--green)">
                    ✓ AES-GCM auth tag verified
                </div>
                <div style="color:var(--green)">
                    ✓ Decryption successful
                </div>`;
        }

        const result =
            document.getElementById('decodeResult');
        if (result) {
            result.textContent = decrypted;
            result.classList.add('show');
        }

        const tag =
            document.getElementById('verifyTag');
        if (tag) {
            tag.innerHTML =
                `<div class="verify-tag verify-ok">
                    ✓ AUTHENTICATED
                </div>`;
        }

        const dsBits =
            document.getElementById('dsBits');
        const dsBytes =
            document.getElementById('dsBytes');
        const dsChars =
            document.getElementById('dsChars');
        if (dsBits)  dsBits.textContent =
            ((extracted.length + 4) * 8).toLocaleString();
        if (dsBytes) dsBytes.textContent = extracted.length;
        if (dsChars) dsChars.textContent = decrypted.length;

        showStatus('decStatus', 'success',
            '✓ Message extracted and decrypted');

    } catch (e) {
        if (pipe) {
            pipe.innerHTML +=
                `<div style="color:var(--red)">
                    ✗ AES-GCM auth tag FAILED
                </div>
                <div style="color:var(--red)">
                    ✗ Wrong password or tampered image
                </div>`;
        }

        const tag =
            document.getElementById('verifyTag');
        if (tag) {
            tag.innerHTML =
                `<div class="verify-tag verify-fail">
                    ✗ TAMPERED / WRONG KEY
                </div>`;
        }

        const result =
            document.getElementById('decodeResult');
        if (result) {
            result.textContent = '';
            result.classList.remove('show');
        }

        showStatus('decStatus', 'error',
            '✗ Wrong password, unsupported data, or damaged image');
    }
}

// ══════════════════════════════════════════
//  VISUALISER
// ══════════════════════════════════════════
async function runVisualiser() {
    const msgEl = document.getElementById('visMsg');
    const pwdEl = document.getElementById('visPwd');
    const msg   = msgEl ? msgEl.value || 'ShadowVault' : 'ShadowVault';
    const pwd   = pwdEl ? pwdEl.value || 'password'    : 'password';

    await Visualiser.run(msg, pwd);
}

function showVisStep(n) {
    Visualiser.showStep(n);
}

// ══════════════════════════════════════════
//  PASSWORD STRENGTH UI
// ══════════════════════════════════════════
function checkStrength(value, barId, labelId) {
    const result = CryptoEngine.checkStrength(value);
    const bar    = document.getElementById(barId);
    const label  = document.getElementById(labelId);
    if (!bar || !label) return;

    bar.style.width      = result.score + '%';
    bar.style.background = result.color;
    label.textContent    = value ? result.label : '';
    label.style.color    = result.color;
}

// ══════════════════════════════════════════
//  VAULT UI
// ══════════════════════════════════════════
function showAddEntry() {
    const panel =
        document.getElementById('addEntryPanel');
    if (!panel) return;
    panel.style.display =
        panel.style.display === 'none' ||
        panel.style.display === ''
            ? 'block' : 'none';
}

async function addVaultEntry() {
    const site  = document.getElementById('entrySite').value;
    const user  = document.getElementById('entryUser').value;
    const pwd   = document.getElementById('entryPwd').value;
    const notes = document.getElementById('entryNotes').value;

    if (!site || !user || !pwd) {
        alert('Please fill in site, username and password');
        return;
    }

    try {
        await VaultManager.addEntry(site, user, pwd, notes);
    } catch (error) {
        showStatus('vaultStatus', 'error', 'Could not save vault changes.');
        return;
    }

    ['entrySite','entryUser','entryPwd','entryNotes']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

    const panel =
        document.getElementById('addEntryPanel');
    if (panel) panel.style.display = 'none';
}

function filterVault(query) {
    VaultManager.renderVault(query);
}

function exportVault() {
    try {
        VaultManager.exportEncryptedBackup();
        showStatus('vaultStatus', 'success', 'Encrypted backup downloaded. Keep it private.');
    } catch (error) {
        showStatus('vaultStatus', 'error', error.message);
    }
}

function generatePassword() {
    const lenEl     = document.getElementById('genLen');
    const upperEl   = document.getElementById('genUpper');
    const lowerEl   = document.getElementById('genLower');
    const digitsEl  = document.getElementById('genDigits');
    const symbolsEl = document.getElementById('genSymbols');

    const len     = lenEl     ? parseInt(lenEl.value)    : 20;
    const upper   = upperEl   ? upperEl.checked          : true;
    const lower   = lowerEl   ? lowerEl.checked          : true;
    const digits  = digitsEl  ? digitsEl.checked         : true;
    const symbols = symbolsEl ? symbolsEl.checked        : true;

    const pwd = VaultManager.generate({
        length: len, upper, lower, digits, symbols
    });

    const out = document.getElementById('genOutput');
    if (out) out.textContent = pwd;

    const strength = VaultManager.getStrengthLabel(pwd);
    const crack    = VaultManager.getCrackTime(pwd);
    const strEl    = document.getElementById('genStrength');
    if (strEl) {
        strEl.innerHTML = `
        <div style="font-family:var(--font-mono);
            font-size:11px;color:${strength.color};
            margin-top:8px;">
            ${strength.label} — Crack time: ${crack}
        </div>`;
    }
}

function genAndFill() {
    generatePassword();
    const pwd = document.getElementById('genOutput');
    const entry = document.getElementById('entryPwd');
    if (pwd && entry) entry.value = pwd.textContent;
}

function copyGenPwd() {
    const out = document.getElementById('genOutput');
    if (!out || out.textContent === 'Press GENERATE') return;
    navigator.clipboard.writeText(out.textContent);
    VaultManager._showClipToast(30);
}

// ══════════════════════════════════════════
//  INTEL — ARCHITECTURE DIAGRAM
// ══════════════════════════════════════════
function buildArchDiagram() {
    const el = document.getElementById('archDiagram');
    if (!el) return;

    el.innerHTML = `
    <div class="arch-wrap">
        <div class="arch-box">
            <span class="arch-class">Main.java</span>
            CLI Entry Point
        </div>
        <div class="arch-arrow">↓ calls</div>
        <div class="arch-box">
            <span class="arch-class">VaultManager.java</span>
            Orchestration Layer
        </div>
        <div class="arch-arrow">↓ uses both</div>
        <div class="arch-row">
            <div class="arch-box" style="width:170px">
                <span class="arch-class">
                    CryptoEngine.java
                </span>
                AES-256-GCM + PBKDF2
            </div>
            <div class="arch-box" style="width:170px">
                <span class="arch-class">
                    StegoEngine.java
                </span>
                LSB Steganography
            </div>
        </div>
        <div class="arch-arrow">↑ used by</div>
        <div class="arch-box">
            <span class="arch-class">
                PasswordGenerator.java
            </span>
            SecureRandom + Scorer
        </div>
    </div>`;
}

// ══════════════════════════════════════════
//  INTEL — SETUP GUIDE
// ══════════════════════════════════════════
function buildSetupGuide() {
    const el = document.getElementById('setupGuide');
    if (!el) return;

    const steps = [
        {
            num: '1',
            title: 'INSTALL JAVA 17',
            desc: `Download JDK 17 from
                <span class="icode">adoptium.net</span>.
                Verify:
                <span class="icode">java -version</span>`
        },
        {
            num: '2',
            title: 'INSTALL MAVEN',
            desc: `Download from
                <span class="icode">maven.apache.org</span>.
                Add to PATH. Verify:
                <span class="icode">mvn -version</span>`
        },
        {
            num: '3',
            title: 'OPEN PROJECT ROOT',
            desc: `Open the folder containing
                <span class="icode">pom.xml</span>
                and the
                <span class="icode">java/</span>
                directory in PowerShell.`
        },
        {
            num: '4',
            title: 'COMPILE',
            desc: `Run
                <span class="icode">mvn clean compile</span>
                to download dependencies and compile the CLI.`
        },
        {
            num: '5',
            title: 'RUN THE CLI',
            desc: `Run
                <span class="icode">mvn exec:java</span>
                to open the interactive vault menu.`
        }
    ];

    el.innerHTML = steps.map(s => `
        <div class="setup-step">
            <div class="setup-num">${s.num}</div>
            <div class="setup-content">
                <div class="setup-title">${s.title}</div>
                <div class="setup-desc">${s.desc}</div>
            </div>
        </div>
    `).join('');
}

// ══════════════════════════════════════════
//  INTEL — CODE VIEWER
// ══════════════════════════════════════════
const javaCodes = {
    crypto: {
        title: 'CryptoEngine.java',
        code: `package shadowvault;

import javax.crypto.*;
import javax.crypto.spec.*;
import java.security.*;
import java.util.Arrays;

public class CryptoEngine {

    private static final int SALT_LENGTH  = 16;
    private static final int IV_LENGTH    = 12;
    private static final int KEY_LENGTH   = 256;
    private static final int ITERATIONS   = 100_000;
    private static final int GCM_TAG_BITS = 128;

    public static byte[] encrypt(
            String plaintext,
            String password) throws Exception {

        byte[] salt = generateRandom(SALT_LENGTH);
        byte[] iv   = generateRandom(IV_LENGTH);
        SecretKey key = deriveKey(password, salt);

        Cipher cipher =
            Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key,
            new GCMParameterSpec(GCM_TAG_BITS, iv));

        byte[] ciphertext = cipher.doFinal(
            plaintext.getBytes("UTF-8"));

        byte[] result = new byte[
            SALT_LENGTH + IV_LENGTH + ciphertext.length];
        System.arraycopy(salt, 0, result, 0, SALT_LENGTH);
        System.arraycopy(iv, 0, result,
            SALT_LENGTH, IV_LENGTH);
        System.arraycopy(ciphertext, 0, result,
            SALT_LENGTH + IV_LENGTH, ciphertext.length);
        return result;
    }

    public static String decrypt(
            byte[] data,
            String password) throws Exception {

        byte[] salt = Arrays.copyOfRange(
            data, 0, SALT_LENGTH);
        byte[] iv   = Arrays.copyOfRange(
            data, SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        byte[] ciphertext = Arrays.copyOfRange(
            data, SALT_LENGTH + IV_LENGTH, data.length);

        SecretKey key = deriveKey(password, salt);

        Cipher cipher =
            Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key,
            new GCMParameterSpec(GCM_TAG_BITS, iv));

        byte[] plaintext = cipher.doFinal(ciphertext);
        return new String(plaintext, "UTF-8");
    }

    public static SecretKey deriveKey(
            String password,
            byte[] salt) throws Exception {

        PBEKeySpec spec = new PBEKeySpec(
            password.toCharArray(),
            salt, ITERATIONS, KEY_LENGTH);

        SecretKeyFactory factory =
            SecretKeyFactory.getInstance(
            "PBKDF2WithHmacSHA256");

        byte[] keyBytes = factory
            .generateSecret(spec).getEncoded();
        spec.clearPassword();
        return new SecretKeySpec(keyBytes, "AES");
    }

    private static byte[] generateRandom(int len) {
        byte[] b = new byte[len];
        new SecureRandom().nextBytes(b);
        return b;
    }

    public static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes)
            sb.append(String.format("%02X ", b));
        return sb.toString().trim();
    }

    public static String scorePassword(String pwd) {
        int score = 0;
        if (pwd.length() >= 8)               score += 20;
        if (pwd.length() >= 12)              score += 15;
        if (pwd.length() >= 16)              score += 10;
        if (pwd.matches(".*[A-Z].*"))        score += 15;
        if (pwd.matches(".*[a-z].*"))        score += 10;
        if (pwd.matches(".*[0-9].*"))        score += 15;
        if (pwd.matches(".*[^A-Za-z0-9].*")) score += 15;
        if (score < 30) return "WEAK";
        if (score < 55) return "MODERATE";
        if (score < 75) return "STRONG";
        return "FORTRESS";
    }
}`
    },
    stego: {
        title: 'StegoEngine.java',
        code: `package shadowvault;

import java.awt.image.BufferedImage;
import java.io.*;
import javax.imageio.ImageIO;
import java.util.Arrays;

public class StegoEngine {

    public static void encode(
            File imageFile,
            byte[] secretData,
            File outputFile) throws Exception {

        BufferedImage img = ImageIO.read(imageFile);
        int width  = img.getWidth();
        int height = img.getHeight();
        int maxBytes = (width * height * 3) / 8 - 4;

        if (secretData.length > maxBytes)
            throw new Exception("Image too small");

        byte[] payload = new byte[4 + secretData.length];
        payload[0] = (byte)(secretData.length >> 24);
        payload[1] = (byte)(secretData.length >> 16);
        payload[2] = (byte)(secretData.length >> 8);
        payload[3] = (byte)(secretData.length);
        System.arraycopy(secretData, 0,
            payload, 4, secretData.length);

        int bitIndex = 0;
        outer:
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int pixel = img.getRGB(x, y);
                int r = (pixel >> 16) & 0xFF;
                int g = (pixel >> 8)  & 0xFF;
                int b =  pixel        & 0xFF;

                if (bitIndex < payload.length * 8)
                    r = setBit(r,
                        getBit(payload, bitIndex++));
                if (bitIndex < payload.length * 8)
                    g = setBit(g,
                        getBit(payload, bitIndex++));
                if (bitIndex < payload.length * 8)
                    b = setBit(b,
                        getBit(payload, bitIndex++));
                else break outer;

                img.setRGB(x, y,
                    (0xFF<<24)|(r<<16)|(g<<8)|b);
            }
        }
        ImageIO.write(img, "PNG", outputFile);
    }

    private static int getBit(byte[] d, int i) {
        return (d[i/8] >> (7 - i%8)) & 1;
    }
    private static int setBit(int v, int bit) {
        return (v & 0xFE) | bit;
    }
}`
    },
    vault: {
        title: 'VaultManager.java',
        code: `package shadowvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

public class VaultManager {

    private List<VaultEntry> entries = new ArrayList<>();
    private static final ObjectMapper mapper =
        new ObjectMapper();

    public void addEntry(String site,
            String username,
            String password,
            String notes) {
        entries.add(new VaultEntry(
            site, username, password, notes));
        System.out.println("✓ Added: " + site);
    }

    public VaultEntry getEntry(String site) {
        return entries.stream()
            .filter(e -> e.getSite()
                .equalsIgnoreCase(site))
            .findFirst().orElse(null);
    }

    public void save(String imagePath,
            String outputPath,
            String masterPassword) throws Exception {
        String json =
            mapper.writeValueAsString(entries);
        byte[] encrypted =
            CryptoEngine.encrypt(json, masterPassword);
        StegoEngine.encode(
            new java.io.File(imagePath),
            encrypted,
            new java.io.File(outputPath));
        System.out.println("✓ Vault saved");
    }

    public void load(String imagePath,
            String masterPassword) throws Exception {
        byte[] extracted =
            StegoEngine.decode(
                new java.io.File(imagePath));
        String json =
            CryptoEngine.decrypt(
                extracted, masterPassword);
        entries = mapper.readValue(json,
            mapper.getTypeFactory()
            .constructCollectionType(
                List.class, VaultEntry.class));
        System.out.println(
            "✓ Loaded " + entries.size() + " entries");
    }
}`
    },
    main: {
        title: 'Main.java',
        code: `package shadowvault;

import org.jline.terminal.*;
import org.jline.reader.*;
import org.jline.reader.impl.completer.NullCompleter;
import java.io.File;

public class Main {

    private static VaultManager vault =
        new VaultManager();
    private static boolean vaultOpen = false;

    public static void main(String[] args)
            throws Exception {
        printBanner();
        Terminal terminal =
            TerminalBuilder.builder()
            .system(true).build();
        LineReader reader =
            LineReaderBuilder.builder()
            .terminal(terminal)
            .completer(new NullCompleter())
            .build();

        while (true) {
            printMenu(vaultOpen);
            String choice = reader
                .readLine("  Enter choice > ").trim();
            switch (choice) {
                case "1" -> createVault(reader);
                case "2" -> openVault(reader);
                case "3" -> { requireOpen();
                    addPassword(reader); }
                case "4" -> { requireOpen();
                    getPassword(reader); }
                case "5" -> { requireOpen();
                    vault.listEntries(); }
                case "8" ->
                    generatePasswordMenu(reader);
                case "9" -> { requireOpen();
                    vault.healthCheck(); }
                case "0" -> {
                    System.out.println(
                        "Vault locked. Goodbye.");
                    System.exit(0);
                }
                default -> System.out.println(
                    "Invalid choice");
            }
        }
    }

    static void printBanner() {
        System.out.println(
        "╔══════════════════════════════╗\\n" +
        "║     SHADOWVAULT v2.4.0       ║\\n" +
        "║  Steganographic Pwd Manager  ║\\n" +
        "╚══════════════════════════════╝");
    }

    static void printMenu(boolean open) {
        System.out.println(
        "\\n  VAULT: " + (open ?
            "🔓 UNLOCKED" : "🔒 LOCKED"));
        System.out.println(
        "  1.Create  2.Open  3.Add\\n" +
        "  4.Get     5.List  8.Generate\\n" +
        "  9.Health  0.Exit");
    }

    static void requireOpen() {
        if (!vaultOpen)
            System.out.println(
                "No vault open. Create or open first.");
    }
}`
    },
    gen: {
        title: 'PasswordGenerator.java',
        code: `package shadowvault;

import java.security.SecureRandom;

public class PasswordGenerator {

    private static final String UPPER   =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final String LOWER   =
        "abcdefghijklmnopqrstuvwxyz";
    private static final String DIGITS  = "0123456789";
    private static final String SYMBOLS =
        "!@#$%^&*()-_=+[]{}|;:,.<>?";

    private static final SecureRandom RANDOM =
        new SecureRandom();

    public static String generate(int length,
            boolean upper, boolean lower,
            boolean digits, boolean symbols) {

        StringBuilder cs = new StringBuilder();
        if (upper)   cs.append(UPPER);
        if (lower)   cs.append(LOWER);
        if (digits)  cs.append(DIGITS);
        if (symbols) cs.append(SYMBOLS);
        if (cs.length() == 0) cs.append(LOWER);

        String charset = cs.toString();
        StringBuilder pwd = new StringBuilder(length);
        for (int i = 0; i < length; i++)
            pwd.append(charset.charAt(
                RANDOM.nextInt(charset.length())));
        return pwd.toString();
    }

    public static String scoreStrength(String pwd) {
        int score = 0;
        if (pwd.length() >= 8)               score += 20;
        if (pwd.length() >= 12)              score += 15;
        if (pwd.length() >= 16)              score += 10;
        if (pwd.matches(".*[A-Z].*"))        score += 15;
        if (pwd.matches(".*[0-9].*"))        score += 15;
        if (pwd.matches(".*[^A-Za-z0-9].*")) score += 10;
        if (score < 30) return "WEAK";
        if (score < 50) return "FAIR";
        if (score < 70) return "STRONG";
        return "FORTRESS";
    }

    public static double entropy(String pwd) {
        int cs = 0;
        if (pwd.matches(".*[a-z].*"))        cs += 26;
        if (pwd.matches(".*[A-Z].*"))        cs += 26;
        if (pwd.matches(".*[0-9].*"))        cs += 10;
        if (pwd.matches(".*[^A-Za-z0-9].*")) cs += 32;
        return cs == 0 ? 0 :
            pwd.length() * (Math.log(cs)/Math.log(2));
    }
}`
    }
};

function buildCodeTabs() {
    const tabs = document.getElementById('codeTabs');
    if (!tabs) return;

    const files = [
        { key: 'crypto', label: 'CryptoEngine' },
        { key: 'stego',  label: 'StegoEngine'  },
        { key: 'vault',  label: 'VaultManager' },
        { key: 'main',   label: 'Main'          },
        { key: 'gen',    label: 'PwdGenerator'  }
    ];

    tabs.innerHTML = files.map(f => `
        <button class="code-tab-btn"
            id="ctab-${f.key}"
            onclick="showCode('${f.key}')">
            ${f.label}
        </button>
    `).join('');
}

function showCode(key) {
    const viewer = document.getElementById('codeViewer');
    const data   = javaCodes[key];
    if (!viewer || !data) return;

    document.querySelectorAll('.code-tab-btn')
        .forEach(b => b.classList.remove('active'));
    const activeTab =
        document.getElementById('ctab-' + key);
    if (activeTab) activeTab.classList.add('active');

    viewer.innerHTML = `
    <div class="code-viewer-wrap">
        <div class="code-viewer-header">
            <div class="code-viewer-title">
                ${data.title}
            </div>
            <button class="btn btn-sm btn-outline"
                onclick="copyCode('${key}')">
                📋 COPY
            </button>
        </div>
        <pre>${escapeHtml(data.code)}</pre>
    </div>`;
}

function copyCode(key) {
    const data = javaCodes[key];
    if (!data) return;
    navigator.clipboard.writeText(data.code);
    VaultManager._showClipToast(5);
}

// ══════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════
function showStatus(id, type, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className     = 'status-msg ' + type;
    el.innerHTML     = message;
    el.style.display = 'block';
}

function escapeHtml(str) {
    return str
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;');
}