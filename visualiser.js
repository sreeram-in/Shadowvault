// ══════════════════════════════════════════
//  SHADOWVAULT — VISUALISER.JS
//  Step-by-step encryption visualiser
//  Neon heatmap + Zoom + Pixel Inspector
// ══════════════════════════════════════════

const Visualiser = {

    currentStep: 0,
    visData: null,
    cubeAngle: 0,
    cubeAnimId: null,
    isDragging: false,
    lastMouseX: 0,
    cubeBytes: null,
    zoomLevel: 1,
    originalImageData: null,
    modifiedImageData: null,
    zoomX: 0,
    zoomY: 0,

    // ── RUN FULL VISUALISER ──
    async run(message, password) {
        try {
            this.visData = await CryptoEngine.getEncryptionDetails(
                message, password, 100000
            );
            this.visData.msg = message;
            this.visData.pwd = password;

            this.renderStep0(this.visData);
            this.renderStep1(this.visData);
            this.renderStep2(this.visData);
            this.renderStep3(this.visData);
            this.renderStep4(this.visData);

            for (let i = 0; i < 5; i++) {
                const btn = document.getElementById('vstep' + i);
                if (btn) {
                    btn.classList.add('done');
                    btn.classList.remove('active');
                }
            }

            this.showStep(0);
            this.cubeBytes = this.visData.ctBytes;
            this.startCube();

        } catch (e) {
            console.error('Visualiser error:', e);
        }
    },

    // ── STEP 0: PLAIN TEXT ──
    renderStep0(data) {
        const { msgBytes } = data;
        const container = document.getElementById('vc0');
        if (!container) return;

        let hexHtml = '';
        msgBytes.forEach((b, i) => {
            hexHtml += `<span class="hex-byte"
                style="animation-delay:${i * 30}ms">
                ${b.toString(16).padStart(2,'0').toUpperCase()}
            </span>`;
        });

        let bitHtml = '';
        msgBytes.forEach(b => {
            for (let i = 7; i >= 0; i--) {
                const bit = (b >> i) & 1;
                bitHtml += `<div class="bit ${bit ? 'b1' : 'b0'}">${bit}</div>`;
            }
        });

        container.innerHTML = `
        <div class="vis-grid">
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">UTF-8 BYTE VALUES</div>
                    <div class="panel-meta">${msgBytes.length} bytes</div>
                </div>
                <div class="panel-body">
                    <div style="font-family:var(--font-mono);
                        font-size:12px;color:var(--dim);
                        margin-bottom:10px;">
                        Message: "${data.msg || ''}"
                    </div>
                    <div class="hex-stream">${hexHtml}</div>
                </div>
            </div>
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">BIT REPRESENTATION</div>
                    <div class="panel-meta">${msgBytes.length * 8} bits</div>
                </div>
                <div class="panel-body">
                    <div class="bit-grid">${bitHtml}</div>
                </div>
            </div>
        </div>`;
    },

    // ── STEP 1: PBKDF2 ──
    renderStep1(data) {
        const { salt, iterations, keyBytes } = data;
        const container = document.getElementById('vc1');
        if (!container) return;

        const saltHex = CryptoEngine.toHex(salt);
        const keyHtml = Array.from(keyBytes)
            .map(b => `<span class="hex-byte">
                ${b.toString(16).padStart(2,'0').toUpperCase()}
            </span>`).join('');

        const entropy  = CryptoEngine.calculateEntropy(data.pwd || 'password');
        const strength = CryptoEngine.checkStrength(data.pwd || 'password');

        container.innerHTML = `
        <div class="vis-grid">
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">KEY DERIVATION PARAMS</div>
                </div>
                <div class="panel-body">
                    <div style="font-family:var(--font-mono);
                        font-size:12px;line-height:3;color:var(--dim);">
                        <div><span style="color:var(--cyan)">ALGORITHM:</span>
                            PBKDF2-SHA256</div>
                        <div><span style="color:var(--cyan)">ITERATIONS:</span>
                            <span style="color:var(--gold)">
                                ${iterations.toLocaleString()}
                            </span>
                        </div>
                        <div><span style="color:var(--cyan)">SALT (16 bytes):</span>
                            <span style="color:var(--green);font-size:10px;">
                                ${saltHex}
                            </span>
                        </div>
                        <div><span style="color:var(--cyan)">OUTPUT:</span>
                            256-bit AES key</div>
                        <div><span style="color:var(--cyan)">BRUTE FORCE:</span>
                            <span style="color:var(--red)">
                                ${iterations.toLocaleString()} ops/guess
                            </span>
                        </div>
                        <div><span style="color:var(--cyan)">ENTROPY:</span>
                            ${entropy} bits</div>
                    </div>
                </div>
            </div>
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">DERIVED KEY + STRENGTH</div>
                </div>
                <div class="panel-body">
                    <div style="font-family:var(--font-mono);
                        font-size:10px;color:var(--dim);
                        margin-bottom:8px;">256-BIT AES KEY:</div>
                    <div class="hex-stream">${keyHtml}</div>
                    <div style="margin-top:20px;text-align:center;">
                        ${this._buildGaugeSVG(strength, entropy)}
                    </div>
                </div>
            </div>
        </div>`;

        setTimeout(() => this._animateGauge(strength, entropy), 100);
    },

    // ── STEP 2: AES-GCM ──
    renderStep2(data) {
        const { iv, msgBytes, ctBytes } = data;
        const container = document.getElementById('vc2');
        if (!container) return;

        const ivHex  = CryptoEngine.toHex(iv);
        const ctHtml = Array.from(ctBytes)
            .map(b => `<span class="hex-byte">
                ${b.toString(16).padStart(2,'0').toUpperCase()}
            </span>`).join('');

        container.innerHTML = `
        <div class="vis-grid">
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">AES-256-GCM PARAMS</div>
                </div>
                <div class="panel-body">
                    <div style="font-family:var(--font-mono);
                        font-size:12px;line-height:3;color:var(--dim);">
                        <div><span style="color:var(--cyan)">MODE:</span>
                            AES-256-GCM</div>
                        <div><span style="color:var(--cyan)">KEY SIZE:</span>
                            256 bits</div>
                        <div><span style="color:var(--cyan)">IV (12 bytes):</span>
                            <span style="color:var(--gold);font-size:10px;">
                                ${ivHex}
                            </span>
                        </div>
                        <div><span style="color:var(--cyan)">INPUT:</span>
                            ${msgBytes.length} bytes</div>
                        <div><span style="color:var(--cyan)">OUTPUT:</span>
                            ${ctBytes.length} bytes + 16 byte tag</div>
                        <div><span style="color:var(--cyan)">AUTH TAG:</span>
                            <span style="color:var(--green)">
                                ✓ Embedded
                            </span>
                        </div>
                        <div><span style="color:var(--cyan)">TAMPER PROOF:</span>
                            <span style="color:var(--green)">✓ YES</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">CIPHERTEXT OUTPUT</div>
                    <div class="panel-meta">${ctBytes.length} bytes</div>
                </div>
                <div class="panel-body">
                    <div style="font-family:var(--font-mono);
                        font-size:10px;color:var(--dim);
                        margin-bottom:8px;">
                        ENCRYPTED BYTES (unreadable without key):
                    </div>
                    <div class="hex-stream">${ctHtml}</div>
                    <div style="margin-top:12px;padding:10px;
                        background:rgba(255,34,68,0.04);
                        border:1px solid rgba(255,34,68,0.2);
                        font-family:var(--font-mono);
                        font-size:11px;color:var(--red);">
                        ⚠ AUTH TAG: Last 16 bytes verify integrity.
                        Any modification → decryption fails instantly.
                    </div>
                </div>
            </div>
        </div>`;
    },

    // ── STEP 3: LSB INJECTION + IMAGE COMPARE + ZOOM ──
    renderStep3(data) {
        const { ctBytes } = data;
        const container = document.getElementById('vc3');
        if (!container) return;

        container.innerHTML = `

        <!-- ── IMAGE COMPARE SECTION ── -->
        <div class="panel" style="margin-bottom:16px;">
            <div class="panel-header">
                <div class="panel-title">
                    BEFORE vs AFTER — IMAGE COMPARISON
                </div>
                <!-- Zoom controls -->
                <div style="display:flex;gap:6px;align-items:center;">
                    <span style="font-family:var(--font-mono);
                        font-size:10px;color:var(--dim);">ZOOM:</span>
                    <button onclick="Visualiser.setZoom(1)"
                        id="zoom1x"
                        class="btn btn-sm btn-primary">1x</button>
                    <button onclick="Visualiser.setZoom(4)"
                        id="zoom4x"
                        class="btn btn-sm btn-outline">4x</button>
                    <button onclick="Visualiser.setZoom(10)"
                        id="zoom10x"
                        class="btn btn-sm btn-outline">10x</button>
                    <button onclick="Visualiser.setZoom(20)"
                        id="zoom20x"
                        class="btn btn-sm btn-outline">20x</button>
                    <button onclick="Visualiser.setZoom(40)"
                        id="zoom40x"
                        class="btn btn-sm btn-outline">40x</button>
                </div>
            </div>
            <div class="panel-body">

                <!-- Upload prompt -->
                <div id="imgComparePrompt" style="
                    text-align:center;padding:30px;
                    border:2px dashed var(--border2);
                    font-family:var(--font-mono);
                    font-size:12px;color:var(--dim);
                ">
                    📡 Upload a carrier image in the INPUT section
                    above to see the neon heatmap comparison
                </div>

                <!-- Compare view -->
                <div id="imgCompareWrap" style="display:none;">

                    <!-- Legend + zoom info -->
                    <div style="
                        display:flex;align-items:center;
                        justify-content:space-between;
                        margin-bottom:10px;
                        font-family:var(--font-mono);font-size:11px;
                    ">
                        <div style="display:flex;gap:20px;">
                            <span style="
                                display:flex;align-items:center;gap:6px;">
                                <span style="
                                    width:14px;height:14px;
                                    border-radius:3px;
                                    background:#00ffc8;
                                    display:inline-block;
                                    box-shadow:0 0 8px #00ffc8,
                                               0 0 16px #00ffc8;
                                "></span>
                                <span style="color:var(--dim);">
                                    Modified pixels (neon glow)
                                </span>
                            </span>
                            <span style="
                                display:flex;align-items:center;gap:6px;">
                                <span style="
                                    width:14px;height:14px;
                                    border-radius:3px;
                                    background:#111;
                                    border:1px solid var(--border);
                                    display:inline-block;
                                "></span>
                                <span style="color:var(--dim);">
                                    Unchanged pixels (darkened)
                                </span>
                            </span>
                        </div>
                        <div style="color:var(--cyan);font-size:10px;"
                            id="zoomInfo">
                            Zoom: 1x | Hover to inspect pixels
                        </div>
                    </div>

                    <!-- Three canvas panels -->
                    <div style="
                        display:grid;
                        grid-template-columns:1fr 1fr 1fr;
                        gap:10px;
                    ">
                        <!-- Original -->
                        <div>
                            <div style="
                                font-family:var(--font-mono);
                                font-size:10px;color:var(--dim);
                                text-align:center;margin-bottom:6px;
                                letter-spacing:0.1em;
                            ">① ORIGINAL</div>
                            <div style="
                                position:relative;overflow:hidden;
                                border:2px solid rgba(0,212,255,0.4);
                                border-radius:3px;
                                box-shadow:0 0 12px rgba(0,212,255,0.15);
                            ">
                                <canvas id="origCanvas"
                                    style="width:100%;display:block;
                                    cursor:crosshair;
                                    image-rendering:pixelated;"></canvas>
                                <div style="
                                    position:absolute;top:6px;left:6px;
                                    background:rgba(0,212,255,0.15);
                                    border:1px solid var(--cyan);
                                    padding:2px 8px;
                                    font-family:var(--font-mono);
                                    font-size:9px;color:var(--cyan);
                                    letter-spacing:0.1em;
                                    backdrop-filter:blur(4px);
                                ">ORIGINAL</div>
                            </div>
                        </div>

                        <!-- Modified -->
                        <div>
                            <div style="
                                font-family:var(--font-mono);
                                font-size:10px;color:var(--dim);
                                text-align:center;margin-bottom:6px;
                                letter-spacing:0.1em;
                            ">② AFTER ENCODING</div>
                            <div style="
                                position:relative;overflow:hidden;
                                border:2px solid rgba(255,34,68,0.4);
                                border-radius:3px;
                                box-shadow:0 0 12px rgba(255,34,68,0.15);
                            ">
                                <canvas id="modCanvas"
                                    style="width:100%;display:block;
                                    cursor:crosshair;
                                    image-rendering:pixelated;"></canvas>
                                <div style="
                                    position:absolute;top:6px;left:6px;
                                    background:rgba(255,34,68,0.15);
                                    border:1px solid var(--red);
                                    padding:2px 8px;
                                    font-family:var(--font-mono);
                                    font-size:9px;color:var(--red);
                                    letter-spacing:0.1em;
                                    backdrop-filter:blur(4px);
                                ">ENCODED</div>
                            </div>
                        </div>

                        <!-- Neon Heatmap -->
                        <div>
                            <div style="
                                font-family:var(--font-mono);
                                font-size:10px;color:var(--dim);
                                text-align:center;margin-bottom:6px;
                                letter-spacing:0.1em;
                            ">③ NEON HEATMAP</div>
                            <div style="
                                position:relative;overflow:hidden;
                                border:2px solid rgba(0,255,200,0.4);
                                border-radius:3px;
                                box-shadow:0 0 16px rgba(0,255,200,0.2);
                            ">
                                <canvas id="heatCanvas"
                                    style="width:100%;display:block;
                                    cursor:crosshair;
                                    image-rendering:pixelated;"></canvas>
                                <div style="
                                    position:absolute;top:6px;left:6px;
                                    background:rgba(0,255,200,0.15);
                                    border:1px solid #00ffc8;
                                    padding:2px 8px;
                                    font-family:var(--font-mono);
                                    font-size:9px;color:#00ffc8;
                                    letter-spacing:0.1em;
                                    backdrop-filter:blur(4px);
                                ">HEATMAP</div>
                            </div>
                        </div>
                    </div>

                    <!-- Pixel Inspector -->
                    <div id="pixelInspector" style="
                        margin-top:10px;padding:10px 14px;
                        background:rgba(0,0,0,0.5);
                        border:1px solid var(--border);
                        font-family:var(--font-mono);font-size:11px;
                        border-radius:2px;
                    ">
                        <span style="color:var(--cyan);
                            letter-spacing:0.1em;">
                            PIXEL INSPECTOR
                        </span>
                        <span id="pixelInspectorData"
                            style="color:var(--dim);margin-left:14px;">
                            ← Hover over any image to inspect pixels
                        </span>
                    </div>

                    <!-- Steganalysis -->
                    <div id="noiseAnalysis" style="margin-top:10px;"></div>
                </div>
            </div>
        </div>

        <!-- ── BIT DETAIL + ZOOM GRID ── -->
        <div class="vis-grid">
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">LSB BIT INJECTION DETAIL</div>
                    <div class="panel-meta">Sample pixels</div>
                </div>
                <div class="panel-body" id="bitInjectionDetail">
                </div>
            </div>
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">ZOOM PIXEL GRID</div>
                    <div class="panel-meta" id="zoomGridInfo">
                        Hover over images above
                    </div>
                </div>
                <div class="panel-body" style="text-align:center;">
                    <canvas id="zoomPixelGrid"
                        style="
                            border:1px solid var(--border);
                            image-rendering:pixelated;
                            max-width:100%;
                        "></canvas>
                    <div style="
                        font-family:var(--font-mono);
                        font-size:10px;color:var(--dim);
                        margin-top:8px;
                    ">
                        Each square = 1 pixel &nbsp;|&nbsp;
                        <span style="color:#00ffc8;">■</span>
                        neon = changed bit
                    </div>
                </div>
            </div>
        </div>`;

        this._buildBitDetail(ctBytes);

        const visImgFile = document.getElementById('visImgInput');
        if (visImgFile && visImgFile.files[0]) {
            this._buildImageCompare(visImgFile.files[0], ctBytes);
        }
    },

    // ── BUILD BIT INJECTION DETAIL ──
    _buildBitDetail(ctBytes) {
        const container = document.getElementById('bitInjectionDetail');
        if (!container) return;

        const samplePixels = [
            [200, 150, 100],
            [201, 151, 101],
            [199, 149,  99]
        ];

        const bits = [];
        ctBytes.slice(0, 12).forEach(b => {
            for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
        });

        function buildBitRow(label, origVal, modVal, changed, color) {
            const origBits = origVal.toString(2).padStart(8,'0');
            const modBits  = modVal.toString(2).padStart(8,'0');

            const origDisplay =
                `<span style="color:${color};letter-spacing:1px;">
                    ${origBits.slice(0,7)}
                </span><span style="
                    color:${color};
                    background:rgba(255,255,255,0.1);
                    padding:1px 4px;border-radius:3px;
                    font-weight:bold;
                    border:1px solid rgba(255,255,255,0.2);
                ">${origBits[7]}</span>`;

            const modDisplay =
                `<span style="color:${color};letter-spacing:1px;">
                    ${modBits.slice(0,7)}
                </span><span style="
                    color:${changed ? '#fff' : color};
                    background:${changed
                        ? 'rgba(255,34,68,0.75)'
                        : 'rgba(0,255,136,0.12)'};
                    padding:1px 4px;border-radius:3px;
                    font-weight:bold;
                    border:1px solid ${changed
                        ? 'rgba(255,34,68,1)'
                        : 'rgba(0,255,136,0.3)'};
                    box-shadow:${changed
                        ? '0 0 10px rgba(255,34,68,0.7)'
                        : 'none'};
                ">${modBits[7]}</span>`;

            const badge = changed
                ? `<span style="
                    color:#fff;background:var(--red);
                    padding:1px 8px;border-radius:3px;
                    font-size:9px;letter-spacing:0.1em;
                    box-shadow:0 0 8px rgba(255,34,68,0.6);
                    white-space:nowrap;
                  ">BIT FLIPPED</span>`
                : `<span style="
                    color:var(--green);
                    background:rgba(0,255,136,0.08);
                    padding:1px 8px;border-radius:3px;
                    font-size:9px;letter-spacing:0.1em;
                    border:1px solid rgba(0,255,136,0.2);
                    white-space:nowrap;
                  ">NO CHANGE</span>`;

            return `
            <div style="
                display:grid;
                grid-template-columns:14px 1fr 16px 1fr auto;
                gap:6px;align-items:center;
                margin-bottom:10px;
                font-family:var(--font-mono);font-size:11px;
            ">
                <span style="color:${color};font-weight:bold;">
                    ${label}:
                </span>
                <span>${origDisplay}</span>
                <span style="color:var(--dimmer);
                    text-align:center;font-size:16px;">→</span>
                <span>${modDisplay}</span>
                ${badge}
            </div>`;
        }

        let html = '';
        samplePixels.forEach((px, i) => {
            const newPx = [...px];
            const b0 = bits[i * 3]     || 0;
            const b1 = bits[i * 3 + 1] || 0;
            const b2 = bits[i * 3 + 2] || 0;
            newPx[0] = (px[0] & 0xFE) | b0;
            newPx[1] = (px[1] & 0xFE) | b1;
            newPx[2] = (px[2] & 0xFE) | b2;

            const rChg = px[0] !== newPx[0];
            const gChg = px[1] !== newPx[1];
            const bChg = px[2] !== newPx[2];
            const anyChg = rChg || gChg || bChg;

            html += `
            <div style="
                margin-bottom:16px;padding:14px;
                background:rgba(0,212,255,0.02);
                border:1px solid ${anyChg
                    ? 'rgba(255,34,68,0.25)'
                    : 'var(--border)'};
                border-radius:2px;
            ">
                <div style="
                    display:flex;align-items:center;
                    justify-content:space-between;
                    margin-bottom:12px;
                ">
                    <span style="font-family:var(--font-mono);
                        font-size:10px;color:var(--dim);
                        letter-spacing:0.15em;">
                        PIXEL ${i + 1}
                    </span>
                    <div style="display:flex;
                        align-items:center;gap:10px;">
                        <div style="
                            width:26px;height:26px;
                            background:rgb(${px[0]},${px[1]},${px[2]});
                            border:2px solid rgba(255,255,255,0.2);
                            border-radius:3px;
                        "></div>
                        <span style="color:var(--dimmer);
                            font-size:16px;">→</span>
                        <div style="
                            width:26px;height:26px;
                            background:rgb(${newPx[0]},${newPx[1]},${newPx[2]});
                            border:2px solid ${anyChg
                                ? 'rgba(255,34,68,0.7)'
                                : 'rgba(0,255,136,0.3)'};
                            border-radius:3px;
                            box-shadow:${anyChg
                                ? '0 0 10px rgba(255,34,68,0.4)'
                                : 'none'};
                        "></div>
                        <span style="
                            font-family:var(--font-mono);
                            font-size:9px;color:var(--green);
                            background:rgba(0,255,136,0.05);
                            border:1px solid rgba(0,255,136,0.2);
                            padding:2px 8px;border-radius:3px;
                        ">👁 INVISIBLE TO EYE</span>
                    </div>
                </div>
                <div style="
                    background:rgba(0,0,0,0.35);
                    padding:10px 12px;border-radius:3px;
                    border:1px solid var(--border);
                ">
                    <div style="
                        font-family:var(--font-mono);
                        font-size:9px;color:var(--dimmer);
                        margin-bottom:10px;letter-spacing:0.1em;
                        display:grid;
                        grid-template-columns:14px 1fr 16px 1fr auto;
                        gap:6px;
                    ">
                        <span></span>
                        <span>ORIGINAL BITS</span>
                        <span></span>
                        <span>MODIFIED BITS</span>
                        <span>STATUS</span>
                    </div>
                    ${buildBitRow('R', px[0], newPx[0], rChg, '#ff8888')}
                    ${buildBitRow('G', px[1], newPx[1], gChg, '#88ff99')}
                    ${buildBitRow('B', px[2], newPx[2], bChg, '#88aaff')}
                </div>
                <div style="
                    margin-top:8px;font-family:var(--font-mono);
                    font-size:10px;color:var(--dim);
                ">
                    Hidden bits: &nbsp;
                    ${[b0,b1,b2].map(bit => `
                        <span style="
                            display:inline-block;
                            width:20px;height:20px;
                            line-height:20px;text-align:center;
                            background:${bit
                                ? 'rgba(0,212,255,0.18)'
                                : 'rgba(20,50,80,0.5)'};
                            border:1px solid ${bit
                                ? 'rgba(0,212,255,0.5)'
                                : 'rgba(20,50,80,0.9)'};
                            color:${bit ? 'var(--cyan)' : 'var(--dimmer)'};
                            border-radius:3px;font-size:12px;
                            font-weight:bold;margin:0 2px;
                        ">${bit}</span>
                    `).join('')}
                    &nbsp; Max change: ±1 out of 255
                </div>
            </div>`;
        });

        container.innerHTML = html;
    },

    // ── BUILD IMAGE COMPARE ──
    _buildImageCompare(file, ctBytes) {
        StegoEngine.loadImageFile(file).then(({ imageData, canvas }) => {
            try {
                this.originalImageData = imageData;

                // Deep copy for modification
                const modData = StegoEngine.encode(
                    new ImageData(
                        new Uint8ClampedArray(imageData.data),
                        imageData.width,
                        imageData.height
                    ),
                    ctBytes
                );
                this.modifiedImageData = modData;

                // Show compare section
                const prompt = document.getElementById('imgComparePrompt');
                const wrap   = document.getElementById('imgCompareWrap');
                if (prompt) prompt.style.display = 'none';
                if (wrap)   wrap.style.display   = 'block';

                // Draw original and modified
                this._drawZoomedCanvas(
                    'origCanvas', imageData,
                    0, 0, 1,
                    canvas.width, canvas.height
                );
                this._drawZoomedCanvas(
                    'modCanvas', modData,
                    0, 0, 1,
                    canvas.width, canvas.height
                );

                // Draw neon heatmap
                const heatmap = StegoEngine.generateHeatmap(
                    imageData, modData
                );
                this._drawZoomedCanvas(
                    'heatCanvas', heatmap,
                    0, 0, 1,
                    canvas.width, canvas.height
                );

                // Setup pixel inspector
                this._setupPixelInspect(
                    imageData, modData,
                    canvas.width, canvas.height
                );

                // Initial zoom pixel grid
                this._updateZoomGrid(0, 0);

                // Steganalysis
                const analysis = StegoEngine.analyzeNoise(modData);
                const noiseDiv = document.getElementById('noiseAnalysis');
                if (noiseDiv) {
                    noiseDiv.innerHTML = `
                    <div style="
                        font-family:var(--font-mono);font-size:11px;
                        padding:12px;border:1px solid var(--border);
                        background:rgba(0,212,255,0.02);
                    ">
                        <span style="color:var(--cyan);
                            letter-spacing:0.1em;">
                            STEGANALYSIS
                        </span>
                        &nbsp;&nbsp;
                        <span style="color:var(--dim);">
                            LSB Ratio: ${analysis.ratio}% ones
                        </span>
                        &nbsp;|&nbsp;
                        <span style="color:var(--dim);">
                            Suspicion: ${analysis.suspicionScore}/100
                        </span>
                        &nbsp;|&nbsp;
                        <span style="color:${
                            analysis.suspicionScore > 80
                                ? 'var(--red)'
                                : 'var(--green)'
                        }">
                            ${analysis.verdict}
                        </span>
                    </div>`;
                }

            } catch (e) {
                console.error('Image compare error:', e);
            }
        });
    },

    // ── DRAW ZOOMED CANVAS ──
    _drawZoomedCanvas(id, imageData, cx, cy, zoom, origW, origH) {
        const canvas = document.getElementById(id);
        if (!canvas || !imageData) return;

        // Set canvas dimensions keeping aspect ratio
        const maxH = 220;
        origW = origW || imageData.width;
        origH = origH || imageData.height;
        const scale = Math.min(1, maxH / origH,
            400 / origW);
        canvas.width  = Math.round(origW * scale);
        canvas.height = Math.round(origH * scale);

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = zoom <= 2;

        if (zoom <= 1) {
            // Draw full image
            const src = StegoEngine.imageDataToCanvas(imageData);
            ctx.drawImage(src, 0, 0,
                canvas.width, canvas.height);
        } else {
            // Calculate zoomed region
            const srcW = Math.max(1,
                Math.ceil(origW / zoom));
            const srcH = Math.max(1,
                Math.ceil(origH / zoom));

            let sx = Math.round(cx - srcW / 2);
            let sy = Math.round(cy - srcH / 2);
            sx = Math.max(0,
                Math.min(sx, origW - srcW));
            sy = Math.max(0,
                Math.min(sy, origH - srcH));

            const src = StegoEngine.imageDataToCanvas(imageData);
            ctx.drawImage(
                src,
                sx, sy, srcW, srcH,
                0,  0,  canvas.width, canvas.height
            );

            // Pixel grid at high zoom
            if (zoom >= 8) {
                ctx.strokeStyle = 'rgba(0,212,255,0.18)';
                ctx.lineWidth   = 0.5;
                const cellW = canvas.width  / srcW;
                const cellH = canvas.height / srcH;
                for (let x = 0; x <= srcW; x++) {
                    ctx.beginPath();
                    ctx.moveTo(x * cellW, 0);
                    ctx.lineTo(x * cellW, canvas.height);
                    ctx.stroke();
                }
                for (let y = 0; y <= srcH; y++) {
                    ctx.beginPath();
                    ctx.moveTo(0, y * cellH);
                    ctx.lineTo(canvas.width, y * cellH);
                    ctx.stroke();
                }
            }

            // Zoom border
            ctx.strokeStyle = 'rgba(0,212,255,0.6)';
            ctx.lineWidth   = 2;
            ctx.strokeRect(1, 1,
                canvas.width - 2, canvas.height - 2);
        }
    },

    // ── SET ZOOM ──
    setZoom(level) {
        this.zoomLevel = level;

        // Update button styles
        [1,4,10,20,40].forEach(z => {
            const btn = document.getElementById('zoom' + z + 'x');
            if (btn) {
                btn.className = level === z
                    ? 'btn btn-sm btn-primary'
                    : 'btn btn-sm btn-outline';
            }
        });

        const info = document.getElementById('zoomInfo');
        if (info) {
            info.textContent =
                `Zoom: ${level}x | Hover to inspect`;
        }

        if (!this.originalImageData) return;

        const cx = this.zoomX || 0;
        const cy = this.zoomY || 0;
        const W  = this.originalImageData.width;
        const H  = this.originalImageData.height;

        this._drawZoomedCanvas(
            'origCanvas', this.originalImageData,
            cx, cy, level, W, H
        );
        this._drawZoomedCanvas(
            'modCanvas', this.modifiedImageData,
            cx, cy, level, W, H
        );

        const heatmap = StegoEngine.generateHeatmap(
            this.originalImageData,
            this.modifiedImageData
        );
        this._drawZoomedCanvas(
            'heatCanvas', heatmap,
            cx, cy, level, W, H
        );

        this._updateZoomGrid(cx, cy);
    },

    // ── UPDATE ZOOM PIXEL GRID ──
    _updateZoomGrid(cx, cy) {
        const canvas = document.getElementById('zoomPixelGrid');
        if (!canvas || !this.originalImageData) return;

        const orig = this.originalImageData;
        const mod  = this.modifiedImageData;
        if (!mod) return;

        const radius   = 6;
        const cellSize = 24;
        const gridSize = radius * 2;

        canvas.width  = gridSize * cellSize;
        canvas.height = gridSize * cellSize;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let dy = 0; dy < gridSize; dy++) {
            for (let dx = 0; dx < gridSize; dx++) {
                const px = cx - radius + dx;
                const py = cy - radius + dy;

                if (px < 0 || py < 0 ||
                    px >= orig.width ||
                    py >= orig.height) {
                    // Out of bounds — draw checkerboard
                    ctx.fillStyle = (dx + dy) % 2 === 0
                        ? '#0a1a2a' : '#0d2030';
                    ctx.fillRect(
                        dx * cellSize, dy * cellSize,
                        cellSize, cellSize
                    );
                    continue;
                }

                const idx = (py * orig.width + px) * 4;

                const oR = orig.data[idx];
                const oG = orig.data[idx + 1];
                const oB = orig.data[idx + 2];
                const mR = mod.data[idx];
                const mG = mod.data[idx + 1];
                const mB = mod.data[idx + 2];

                const changed =
                    oR !== mR || oG !== mG || oB !== mB;

                const x = dx * cellSize;
                const y = dy * cellSize;

                // Draw actual pixel color
                ctx.fillStyle =
                    `rgb(${mR},${mG},${mB})`;
                ctx.fillRect(x, y, cellSize, cellSize);

                // Neon overlay for changed pixels
                if (changed) {
                    // Glow overlay
                    ctx.fillStyle = 'rgba(0,255,200,0.5)';
                    ctx.fillRect(x, y, cellSize, cellSize);

                    // Neon border
                    ctx.strokeStyle = '#00ffc8';
                    ctx.lineWidth   = 2;
                    ctx.shadowColor = '#00ffc8';
                    ctx.shadowBlur  = 8;
                    ctx.strokeRect(
                        x + 1, y + 1,
                        cellSize - 2, cellSize - 2
                    );
                    ctx.shadowBlur = 0;

                    // Dot indicator top-right
                    ctx.fillStyle = '#00ffc8';
                    ctx.shadowColor = '#00ffc8';
                    ctx.shadowBlur  = 6;
                    ctx.beginPath();
                    ctx.arc(
                        x + cellSize - 5,
                        y + 5, 4, 0, Math.PI * 2
                    );
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }

                // Center crosshair
                if (dx === radius && dy === radius) {
                    ctx.strokeStyle = '#00d4ff';
                    ctx.lineWidth   = 2;
                    ctx.shadowColor = '#00d4ff';
                    ctx.shadowBlur  = 6;
                    ctx.strokeRect(
                        x + 1, y + 1,
                        cellSize - 2, cellSize - 2
                    );
                    ctx.shadowBlur = 0;
                }

                // Subtle grid lines
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth   = 0.5;
                ctx.shadowBlur  = 0;
                ctx.strokeRect(x, y, cellSize, cellSize);
            }
        }

        const info = document.getElementById('zoomGridInfo');
        if (info) {
            const idx = (cy * orig.width + cx) * 4;
            const oR = orig.data[idx];
            const oG = orig.data[idx + 1];
            const oB = orig.data[idx + 2];
            const mR = mod.data[idx];
            const mG = mod.data[idx + 1];
            const mB = mod.data[idx + 2];
            const changed =
                oR !== mR || oG !== mG || oB !== mB;
            info.innerHTML =
                `(${cx},${cy}) &nbsp;
                <span style="color:#00ffc8;">■</span>
                = changed &nbsp;|&nbsp;
                <span style="color:${
                    changed ? '#00ffc8' : 'var(--green)'
                }">
                    ${changed ? '🟢 MODIFIED' : '✓ CLEAN'}
                </span>`;
        }
    },

    // ── SETUP PIXEL INSPECTOR ──
    _setupPixelInspect(origData, modData, origW, origH) {
        ['origCanvas','modCanvas','heatCanvas'].forEach(id => {
            const canvas = document.getElementById(id);
            if (!canvas) return;

            canvas.addEventListener('mousemove', e => {
                const rect = canvas.getBoundingClientRect();
                const mx   = e.clientX - rect.left;
                const my   = e.clientY - rect.top;

                const zoom = this.zoomLevel || 1;
                const srcW = Math.ceil(origW / zoom);
                const srcH = Math.ceil(origH / zoom);

                let sx = Math.round(
                    (this.zoomX || 0) - srcW / 2);
                let sy = Math.round(
                    (this.zoomY || 0) - srcH / 2);
                sx = Math.max(0,
                    Math.min(sx, origW - srcW));
                sy = Math.max(0,
                    Math.min(sy, origH - srcH));

                const px = Math.floor(
                    sx + (mx / canvas.offsetWidth) * srcW
                );
                const py = Math.floor(
                    sy + (my / canvas.offsetHeight) * srcH
                );

                if (px < 0 || py < 0 ||
                    px >= origW || py >= origH) return;

                const idx = (py * origW + px) * 4;

                const oR = origData.data[idx];
                const oG = origData.data[idx + 1];
                const oB = origData.data[idx + 2];
                const mR = modData.data[idx];
                const mG = modData.data[idx + 1];
                const mB = modData.data[idx + 2];

                const changed =
                    oR!==mR || oG!==mG || oB!==mB;

                const el = document.getElementById(
                    'pixelInspectorData'
                );
                if (el) {
                    el.innerHTML = `
                    (${px}, ${py}) &nbsp;|&nbsp;
                    ORIG: 
                    <span style="color:#ff8888;">R${oR}</span>
                    <span style="color:#88ff99;">G${oG}</span>
                    <span style="color:#88aaff;">B${oB}</span>
                    &nbsp;→&nbsp;
                    MOD: 
                    <span style="color:#ff8888;">R${mR}</span>
                    <span style="color:#88ff99;">G${mG}</span>
                    <span style="color:#88aaff;">B${mB}</span>
                    &nbsp;|&nbsp;
                    <span style="color:${
                        changed ? '#00ffc8' : 'var(--green)'
                    };font-weight:bold;">
                        ${changed
                            ? '⬤ LSB MODIFIED'
                            : '✓ UNCHANGED'}
                    </span>`;
                }

                // Update zoom center + grid
                this.zoomX = px;
                this.zoomY = py;
                this._updateZoomGrid(px, py);
            });
        });
    },

    // ── STEP 4: OUTPUT ──
    renderStep4(data) {
        const { ctBytes, totalPayload } = data;
        const container = document.getElementById('vc4');
        if (!container) return;

        container.innerHTML = `
        <div class="vis-grid">
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">PAYLOAD LAYOUT</div>
                </div>
                <div class="panel-body">
                    <div style="font-family:var(--font-mono);
                        font-size:12px;line-height:3;color:var(--dim);">
                        <div><span style="color:var(--cyan)">
                            [0-3] HEADER:</span>
                            4 bytes (data length)
                        </div>
                        <div><span style="color:var(--cyan)">
                            [4-7] ITERATIONS:</span>
                            4 bytes
                        </div>
                        <div><span style="color:var(--cyan)">
                            [8-23] SALT:</span>
                            16 bytes (random)
                        </div>
                        <div><span style="color:var(--cyan)">
                            [24-35] IV:</span>
                            12 bytes (random)
                        </div>
                        <div><span style="color:var(--cyan)">
                            [36+] CIPHERTEXT:</span>
                            ${ctBytes.length} bytes
                        </div>
                        <div>
                            <span style="color:var(--gold)">
                                TOTAL:</span>
                            <span style="color:var(--gold)">
                                ${totalPayload} bytes
                            </span>
                        </div>
                        <div><span style="color:var(--cyan)">
                            PIXELS MODIFIED:</span>
                            ~${Math.ceil(
                                totalPayload * 8 / 3
                            ).toLocaleString()}
                        </div>
                        <div><span style="color:var(--green)">
                            OUTPUT FORMAT:</span>
                            PNG lossless only
                        </div>
                    </div>
                </div>
            </div>
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">3D PIXEL CUBE</div>
                </div>
                <div class="panel-body" style="text-align:center;">
                    <canvas id="cube3d" height="260"
                        style="width:100%;cursor:grab;">
                    </canvas>
                    <div style="
                        font-family:var(--font-mono);
                        font-size:10px;color:var(--dim);
                        margin-top:8px;
                        display:flex;justify-content:center;
                        gap:16px;
                    ">
                        <span style="display:flex;
                            align-items:center;gap:4px;">
                            <span style="width:10px;height:10px;
                                background:#ff5050;border-radius:2px;
                                display:inline-block;"></span>R
                        </span>
                        <span style="display:flex;
                            align-items:center;gap:4px;">
                            <span style="width:10px;height:10px;
                                background:#50ff90;border-radius:2px;
                                display:inline-block;"></span>G
                        </span>
                        <span style="display:flex;
                            align-items:center;gap:4px;">
                            <span style="width:10px;height:10px;
                                background:#5090ff;border-radius:2px;
                                display:inline-block;"></span>B
                        </span>
                        <span style="color:var(--dimmer);">
                            | Drag to rotate
                        </span>
                    </div>
                </div>
            </div>
        </div>`;

        setTimeout(() => {
            this._initCubeEvents();
            this.startCube();
        }, 100);
    },

    // ── SHOW STEP ──
    showStep(n) {
        document.querySelectorAll('.vis-content')
            .forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.vis-btn')
            .forEach(b => b.classList.remove('active'));

        const content = document.getElementById('vc' + n);
        const btn     = document.getElementById('vstep' + n);
        if (content) content.classList.add('active');
        if (btn)     btn.classList.add('active');

        this.currentStep = n;

        if (n === 4) {
            setTimeout(() => {
                this._initCubeEvents();
                this.startCube();
            }, 100);
        }
    },

    // ── BUILD GAUGE SVG ──
    _buildGaugeSVG(strength, entropy) {
        return `
        <svg id="strengthGauge" viewBox="0 0 200 120"
            style="width:200px;height:120px;">
            <path d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none" stroke="#1a3a5a"
                stroke-width="12" stroke-linecap="round"/>
            <path d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none" stroke="url(#gaugeGrad)"
                stroke-width="12" stroke-linecap="round"
                stroke-dasharray="251" stroke-dashoffset="251"
                id="gaugePath"/>
            <defs>
                <linearGradient id="gaugeGrad"
                    x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stop-color="#ff2244"/>
                    <stop offset="50%"  stop-color="#ffcc00"/>
                    <stop offset="100%" stop-color="#00ff88"/>
                </linearGradient>
            </defs>
            <text x="100" y="92" text-anchor="middle"
                font-family="Orbitron" font-size="15"
                fill="${strength.color}" id="gaugeLabel">
                ${strength.label}
            </text>
            <text x="100" y="110" text-anchor="middle"
                font-family="Share Tech Mono" font-size="9"
                fill="#4a7a9b" id="gaugeSub">
                ${entropy} ENTROPY BITS
            </text>
        </svg>`;
    },

    // ── ANIMATE GAUGE ──
    _animateGauge(strength, entropy) {
        const path = document.getElementById('gaugePath');
        if (!path) return;
        const pct    = Math.min(100, entropy);
        const offset = 251 - (pct / 100) * 251;
        path.style.transition = 'stroke-dashoffset 1.2s ease';
        path.setAttribute('stroke-dashoffset', offset);
    },

    // ── 3D CUBE ──
    startCube() {
        const canvas = document.getElementById('cube3d');
        if (!canvas) return;

        if (this.cubeAnimId) {
            cancelAnimationFrame(this.cubeAnimId);
        }

        const bytes = this.cubeBytes ||
            new Uint8Array(64).map(
                () => Math.round(Math.random())
            );

        const bits = Array.from(bytes.slice(0, 64))
            .flatMap(b => Array.from(
                { length: 8 },
                (_, i) => (b >> (7 - i)) & 1
            ));

        const W = canvas.offsetWidth || 400;
        const H = 260;
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        const frame = () => {
            this.cubeAngle += 0.008;
            ctx.clearRect(0, 0, W, H);

            const cx  = W / 2;
            const cy  = H / 2;
            const gap = 18;
            const cos = Math.cos(this.cubeAngle);
            const sin = Math.sin(this.cubeAngle);
            const cy2 = Math.cos(0.4);
            const sy2 = Math.sin(0.4);

            const points = [];

            for (let x = 0; x < 8; x++) {
                for (let y = 0; y < 6; y++) {
                    for (let z = 0; z < 8; z++) {
                        const idx =
                            x * 6 * 8 + y * 8 + z;
                        const bit =
                            bits[idx % bits.length];

                        const rx = (x - 3.5) * gap;
                        const ry = (y - 2.5) * gap;
                        const rz = (z - 3.5) * gap;

                        const rx2 = rx*cos - rz*sin;
                        const rz2 = rx*sin + rz*cos;
                        const ry2 = ry*cy2 - rz2*sy2;
                        const rz3 = ry*sy2 + rz2*cy2;

                        const px = cx + rx2;
                        const py = cy + ry2 - rz3*0.3;

                        const channel =
                            x < 3 ? 'r' :
                            x < 6 ? 'g' : 'b';
                        const alpha = Math.max(
                            0.08, (rz3 + 120) / 180
                        );

                        points.push({
                            px, py, rz3,
                            bit, channel, alpha
                        });
                    }
                }
            }

            points.sort((a, b) => a.rz3 - b.rz3);

            points.forEach(p => {
                const s = Math.max(
                    2, 4 * (1 + p.rz3 / 200)
                );

                if (p.bit) {
                    const col =
                        p.channel === 'r'
                          ? `rgba(255,80,80,${p.alpha})`
                        : p.channel === 'g'
                          ? `rgba(80,255,140,${p.alpha})`
                          : `rgba(80,140,255,${p.alpha})`;
                    ctx.fillStyle   = col;
                    ctx.shadowColor = col;
                    ctx.shadowBlur  = 5;
                } else {
                    ctx.fillStyle =
                        `rgba(15,35,55,${p.alpha*0.5})`;
                    ctx.shadowBlur = 0;
                }

                ctx.fillRect(
                    p.px - s/2, p.py - s/2, s, s
                );
            });

            ctx.shadowBlur  = 0;
            this.cubeAnimId =
                requestAnimationFrame(frame);
        };

        frame();
    },

    // ── INIT CUBE DRAG ──
    _initCubeEvents() {
        const canvas = document.getElementById('cube3d');
        if (!canvas || canvas.dataset.eventsSet) return;
        canvas.dataset.eventsSet = '1';

        canvas.addEventListener('mousedown', e => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            canvas.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', e => {
            if (!this.isDragging) return;
            this.cubeAngle +=
                (e.clientX - this.lastMouseX) * 0.02;
            this.lastMouseX = e.clientX;
        });
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            if (canvas) canvas.style.cursor = 'grab';
        });
    }
};