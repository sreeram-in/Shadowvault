// ══════════════════════════════════════════
//  SHADOWVAULT — STEGO.JS
//  LSB Steganography Engine
// ══════════════════════════════════════════

const StegoEngine = {

    // ── ENCODE ──
    // Hides secretBytes inside imageData pixel LSBs
    encode(imageData, secretBytes) {
        const data = new Uint8ClampedArray(imageData.data);
        const w    = imageData.width;
        const h    = imageData.height;

        const maxBytes = this.getCapacity(w, h);
        if (maxBytes <= 0 || secretBytes.length > maxBytes) {
            throw new Error(
                `Image too small. Max: ${maxBytes} bytes, ` +
                `need: ${secretBytes.length} bytes`
            );
        }

        // Build payload: [4 byte length header] + [data]
        const payload = new Uint8Array(4 + secretBytes.length);
        payload[0] = (secretBytes.length >> 24) & 0xFF;
        payload[1] = (secretBytes.length >> 16) & 0xFF;
        payload[2] = (secretBytes.length >>  8) & 0xFF;
        payload[3] =  secretBytes.length        & 0xFF;
        payload.set(secretBytes, 4);

        // Convert payload to flat bit array
        const bits = [];
        payload.forEach(byte => {
            for (let i = 7; i >= 0; i--) {
                bits.push((byte >> i) & 1);
            }
        });

        let bitIdx = 0;

        for (let i = 0; i < data.length && bitIdx < bits.length; i += 4) {
            // R channel
            if (bitIdx < bits.length) {
                data[i] = (data[i] & 0xFE) | bits[bitIdx++];
            }
            // G channel
            if (bitIdx < bits.length) {
                data[i + 1] = (data[i + 1] & 0xFE) | bits[bitIdx++];
            }
            // B channel (skip Alpha)
            if (bitIdx < bits.length) {
                data[i + 2] = (data[i + 2] & 0xFE) | bits[bitIdx++];
            }
        }

        return new ImageData(data, w, h);
    },

    // ── DECODE ──
    // Extracts hidden bytes from stego imageData
    decode(imageData) {
        const data = imageData.data;
        const maxBytes = this.getCapacity(
            imageData.width, imageData.height
        );

        if (maxBytes < 1) {
            throw new Error('Image is too small to contain ShadowVault data.');
        }

        // Extract all LSBs from R,G,B
        const bits = [];
        for (let i = 0; i < data.length; i += 4) {
            bits.push(data[i]     & 1); // R
            bits.push(data[i + 1] & 1); // G
            bits.push(data[i + 2] & 1); // B
        }

        // Read 32-bit length header
        let dataLength = 0;
        for (let i = 0; i < 32; i++) {
            dataLength = dataLength * 2 + bits[i];
        }

        if (dataLength <= 0 || dataLength > maxBytes ||
            dataLength > 10_000_000) {
            throw new Error(
                'Invalid payload length. ' +
                'Is this a ShadowVault encoded image?'
            );
        }

        // Extract data bytes after header
        const result = new Uint8Array(dataLength);
        for (let i = 0; i < dataLength; i++) {
            let byte = 0;
            for (let j = 0; j < 8; j++) {
                byte = (byte << 1) | bits[32 + i * 8 + j];
            }
            result[i] = byte;
        }

        return result;
    },

    // ── GET CAPACITY ──
    getCapacity(width, height) {
        return Math.max(0, Math.floor(width * height * 3 / 8) - 4);
    },

    // ── GET CAPACITY PERCENT ──
    getCapacityPercent(width, height, usedBytes) {
        const max = this.getCapacity(width, height);
        if (max === 0) return 100;
        return Math.min(100, Math.max(0, Math.round(usedBytes / max * 100)));
    },

    // ── GENERATE HEATMAP (NEON GLOW VERSION) ──
    generateHeatmap(original, modified) {
        const width  = original.width;
        const height = original.height;
        const output = new ImageData(
            new Uint8ClampedArray(original.data),
            width, height
        );

        for (let i = 0; i < original.data.length; i += 4) {
            const rChg = original.data[i]     !== modified.data[i];
            const gChg = original.data[i + 1] !== modified.data[i + 1];
            const bChg = original.data[i + 2] !== modified.data[i + 2];
            const changed = rChg || gChg || bChg;

            if (changed) {
                // Neon cyan-green on changed pixels — fully visible
                output.data[i]     = 0;   // R off
                output.data[i + 1] = 255; // G full
                output.data[i + 2] = 200; // B cyan tint
                output.data[i + 3] = 255; // A full
            } else {
                // Darken unchanged pixels heavily so changed ones pop
                output.data[i]     = Math.floor(original.data[i]     * 0.12);
                output.data[i + 1] = Math.floor(original.data[i + 1] * 0.12);
                output.data[i + 2] = Math.floor(original.data[i + 2] * 0.12);
                output.data[i + 3] = 255;
            }
        }

        return output;
    },

    // ── GENERATE AMPLIFIED DIFF ──
    // Makes 1-value LSB differences actually visible
    generateAmplifiedDiff(original, modified) {
        const width  = original.width;
        const height = original.height;
        const output = new ImageData(
            new Uint8ClampedArray(original.data.length),
            width, height
        );

        for (let i = 0; i < original.data.length; i += 4) {
            const rDiff = Math.abs(original.data[i]     - modified.data[i]);
            const gDiff = Math.abs(original.data[i + 1] - modified.data[i + 1]);
            const bDiff = Math.abs(original.data[i + 2] - modified.data[i + 2]);
            const changed = rDiff > 0 || gDiff > 0 || bDiff > 0;

            if (changed) {
                // Amplify difference by 255x so 1-value change = full brightness
                output.data[i]     = rDiff * 255;
                output.data[i + 1] = gDiff * 255;
                output.data[i + 2] = bDiff * 255;
                output.data[i + 3] = 255;
            } else {
                // Pure black for unchanged
                output.data[i]     = 0;
                output.data[i + 1] = 0;
                output.data[i + 2] = 0;
                output.data[i + 3] = 255;
            }
        }

        return output;
    },

    // ── ANALYZE NOISE ──
    analyzeNoise(imageData) {
        const data = imageData.data;
        let ones = 0;
        let total = 0;

        for (let i = 0; i < data.length; i += 4) {
            ones  += (data[i]     & 1);
            ones  += (data[i + 1] & 1);
            ones  += (data[i + 2] & 1);
            total += 3;
        }

        const ratio          = Math.round(ones / total * 100);
        const deviation      = Math.abs(ratio - 50);
        const suspicionScore = Math.max(0, 100 - deviation * 4);

        let verdict;
        if (suspicionScore > 80) {
            verdict = '⚠ HIGH SUSPICION — LSB pattern detected';
        } else if (suspicionScore > 50) {
            verdict = '~ MODERATE — Slightly unnatural LSB ratio';
        } else {
            verdict = '✓ LOW SUSPICION — Looks like natural image';
        }

        return { ratio, suspicionScore, verdict };
    },

    // ── GET PIXEL COMPARE ──
    getPixelCompare(original, modified, count = 5) {
        const results = [];
        for (let i = 0; i < count; i++) {
            const idx = i * 4;
            results.push({
                pixel: i,
                orig: {
                    r: original.data[idx],
                    g: original.data[idx + 1],
                    b: original.data[idx + 2]
                },
                mod: {
                    r: modified.data[idx],
                    g: modified.data[idx + 1],
                    b: modified.data[idx + 2]
                },
                changed:
                    original.data[idx]     !== modified.data[idx]     ||
                    original.data[idx + 1] !== modified.data[idx + 1] ||
                    original.data[idx + 2] !== modified.data[idx + 2]
            });
        }
        return results;
    },

    // ── LOAD IMAGE FILE ──
    loadImageFile(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width  = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(
                    0, 0, canvas.width, canvas.height
                );
                URL.revokeObjectURL(url);
                resolve({ imageData, canvas });
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image'));
            };

            img.src = url;
        });
    },

    // ── IMAGE DATA TO CANVAS ──
    imageDataToCanvas(imageData) {
        const canvas = document.createElement('canvas');
        canvas.width  = imageData.width;
        canvas.height = imageData.height;
        canvas.getContext('2d').putImageData(imageData, 0, 0);
        return canvas;
    }
};