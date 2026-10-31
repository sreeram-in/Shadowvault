package shadowvault;

import java.awt.image.BufferedImage;
import java.io.*;
import javax.imageio.ImageIO;
import java.util.Arrays;

/**
 * StegoEngine.java
 * LSB Steganography Engine
 * Hides encrypted bytes inside PNG image pixels
 *
 * How it works:
 * Each pixel has R, G, B channels (0-255)
 * We replace the Least Significant Bit of each channel
 * with 1 bit of secret data
 * Change of max 1/255 — completely invisible to human eyes
 * 3 bits per pixel capacity
 */
public class StegoEngine {

    // ── ENCODE ──
    // Hides secretData inside imageFile
    // Saves result to outputFile (must be PNG)
    public static void encode(
            File imageFile,
            byte[] secretData,
            File outputFile) throws Exception {

        // Load carrier image
        BufferedImage img = ImageIO.read(imageFile);
        if (img == null) {
            throw new Exception(
                "Cannot read image: " + imageFile.getName());
        }

        int width  = img.getWidth();
        int height = img.getHeight();

        // Check capacity
        // 3 bits per pixel, minus 4 bytes for header
        int maxBytes = (width * height * 3) / 8 - 4;
        if (maxBytes <= 0 || secretData.length > maxBytes) {
            throw new Exception(
                "Image too small. " +
                "Max: " + maxBytes + " bytes, " +
                "Need: " + secretData.length + " bytes. " +
                "Use a larger image.");
        }

        // Build payload
        // Layout: [length header: 4 bytes] + [secret data]
        byte[] payload = buildPayload(secretData);

        // Convert payload to bit array
        int[] bits = toBitArray(payload);

        // Inject bits into pixel LSBs
        int bitIndex = 0;

        outerLoop:
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {

                // Get current pixel
                int pixel = img.getRGB(x, y);
                int a = (pixel >> 24) & 0xFF; // Alpha
                int r = (pixel >> 16) & 0xFF; // Red
                int g = (pixel >> 8)  & 0xFF; // Green
                int b =  pixel        & 0xFF; // Blue

                // Inject 1 bit into R channel
                if (bitIndex < bits.length) {
                    r = (r & 0xFE) | bits[bitIndex++];
                }
                // Inject 1 bit into G channel
                if (bitIndex < bits.length) {
                    g = (g & 0xFE) | bits[bitIndex++];
                }
                // Inject 1 bit into B channel
                if (bitIndex < bits.length) {
                    b = (b & 0xFE) | bits[bitIndex++];
                }

                // Reassemble pixel with modified channels
                int newPixel = (a << 24) |
                               (r << 16) |
                               (g << 8)  |
                                b;
                img.setRGB(x, y, newPixel);
                if (bitIndex >= bits.length) break outerLoop;
            }
        }

        // Save as PNG (lossless — required!)
        // JPEG compression would destroy the hidden bits
        if (!outputFile.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".png")) {
            outputFile = new File(
                outputFile.getPath() + ".png");
        }
        ImageIO.write(img, "PNG", outputFile);

        System.out.println(
            "✓ Encoded " + secretData.length +
            " bytes into " + outputFile.getName());
    }

    // ── DECODE ──
    // Extracts hidden bytes from a stego image
    public static byte[] decode(File imageFile)
            throws Exception {

        BufferedImage img = ImageIO.read(imageFile);
        if (img == null) {
            throw new Exception(
                "Cannot read image: " + imageFile.getName());
        }

        int width  = img.getWidth();
        int height = img.getHeight();

        // Extract all LSBs from R,G,B channels
        int totalPixels = width * height;
        int[] extractedBits = new int[totalPixels * 3];
        int bitIndex = 0;

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int pixel = img.getRGB(x, y);
                int r = (pixel >> 16) & 0xFF;
                int g = (pixel >> 8)  & 0xFF;
                int b =  pixel        & 0xFF;

                extractedBits[bitIndex++] = r & 1;
                extractedBits[bitIndex++] = g & 1;
                extractedBits[bitIndex++] = b & 1;
            }
        }

        // Read 32-bit length header from first 32 bits
        int dataLength = bitsToInt(
            Arrays.copyOfRange(extractedBits, 0, 32));
        int maxBytes = (width * height * 3) / 8 - 4;

        // Validate extracted length
        if (dataLength <= 0 || dataLength > maxBytes ||
            dataLength > 10_000_000) {
            throw new Exception(
                "No valid ShadowVault data found. " +
                "Is this a ShadowVault encoded image?");
        }

        System.out.println(
            "▶ Found hidden data: " +
            dataLength + " bytes");

        // Extract data bytes after header
        byte[] result = new byte[dataLength];
        for (int i = 0; i < dataLength; i++) {
            int start = 32 + i * 8;
            result[i] = (byte) bitsToInt(
                Arrays.copyOfRange(
                    extractedBits, start, start + 8));
        }

        return result;
    }

    // ── GET CAPACITY ──
    public static int getCapacity(File imageFile)
            throws Exception {
        BufferedImage img = ImageIO.read(imageFile);
        if (img == null) throw new Exception("Cannot read image");
        return Math.max(0,
            (img.getWidth() * img.getHeight() * 3) / 8 - 4);
    }

    // ── BUILD PAYLOAD ──
    // Prepends 4-byte length header to data
    private static byte[] buildPayload(byte[] data) {
        byte[] payload = new byte[4 + data.length];

        // Write length as 4 bytes big-endian
        payload[0] = (byte)((data.length >> 24) & 0xFF);
        payload[1] = (byte)((data.length >> 16) & 0xFF);
        payload[2] = (byte)((data.length >> 8)  & 0xFF);
        payload[3] = (byte)( data.length        & 0xFF);

        System.arraycopy(data, 0, payload, 4, data.length);
        return payload;
    }

    // ── BYTES TO BIT ARRAY ──
    private static int[] toBitArray(byte[] bytes) {
        int[] bits = new int[bytes.length * 8];
        for (int i = 0; i < bytes.length; i++) {
            for (int j = 7; j >= 0; j--) {
                bits[i * 8 + (7 - j)] =
                        (bytes[i] >> j) & 1;
            }
        }
        return bits;
    }

    // ── BIT ARRAY TO INT ──
    private static int bitsToInt(int[] bits) {
        int value = 0;
        for (int bit : bits) {
            value = (value << 1) | bit;
        }
        return value;
    }

    // ── PRINT IMAGE INFO ──
    public static void printImageInfo(File imageFile)
            throws Exception {
        BufferedImage img = ImageIO.read(imageFile);
        if (img == null) return;

        int cap = getCapacity(imageFile);
        System.out.println("Image: " + imageFile.getName());
        System.out.println(
            "Size: " + img.getWidth() +
            "×" + img.getHeight());
        System.out.println(
            "Capacity: " + cap + " bytes (" +
            (cap / 1024) + " KB)");
    }
}