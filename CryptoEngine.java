package shadowvault;

import javax.crypto.*;
import javax.crypto.spec.*;
import java.security.*;
import java.util.Arrays;
import java.util.Base64;

/**
 * CryptoEngine.java
 * Handles all encryption and decryption
 * AES-256-GCM + PBKDF2 Key Derivation
 */
public class CryptoEngine {

    // ── CONSTANTS ──
    private static final int SALT_LENGTH  = 16;  // 128-bit salt
    private static final int IV_LENGTH    = 12;  // 96-bit IV for GCM
    private static final int KEY_LENGTH   = 256; // AES-256
    private static final int ITERATIONS   = 100_000; // PBKDF2 rounds
    private static final int GCM_TAG_BITS = 128; // Auth tag size

    // ── ENCRYPT ──
    // Input:  plaintext string + master password
    // Output: salt(16) + IV(12) + ciphertext+tag
    public static byte[] encrypt(
            String plaintext,
            String password) throws Exception {

        // Step 1: Generate random salt and IV
        byte[] salt = generateRandom(SALT_LENGTH);
        byte[] iv   = generateRandom(IV_LENGTH);

        // Step 2: Derive AES key from password
        SecretKey key = deriveKey(password, salt);

        // Step 3: Encrypt with AES-256-GCM
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        GCMParameterSpec paramSpec =
                new GCMParameterSpec(GCM_TAG_BITS, iv);
        cipher.init(Cipher.ENCRYPT_MODE, key, paramSpec);

        byte[] ciphertext = cipher.doFinal(
                plaintext.getBytes("UTF-8"));

        // Step 4: Assemble output
        // Layout: [salt:16][iv:12][ciphertext+tag]
        byte[] result = new byte[
                SALT_LENGTH + IV_LENGTH + ciphertext.length];

        System.arraycopy(salt, 0,
                result, 0, SALT_LENGTH);
        System.arraycopy(iv, 0,
                result, SALT_LENGTH, IV_LENGTH);
        System.arraycopy(ciphertext, 0,
                result, SALT_LENGTH + IV_LENGTH,
                ciphertext.length);

        return result;
    }

    // ── DECRYPT ──
    // Input:  encrypted bytes + master password
    // Output: original plaintext string
    // Throws: AEADBadTagException if wrong password
    public static String decrypt(
            byte[] data,
            String password) throws Exception {

        // Extract components
        byte[] salt = Arrays.copyOfRange(
                data, 0, SALT_LENGTH);
        byte[] iv   = Arrays.copyOfRange(
                data, SALT_LENGTH,
                SALT_LENGTH + IV_LENGTH);
        byte[] ciphertext = Arrays.copyOfRange(
                data, SALT_LENGTH + IV_LENGTH,
                data.length);

        // Re-derive the same key
        SecretKey key = deriveKey(password, salt);

        // Decrypt — throws if auth tag fails
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        GCMParameterSpec paramSpec =
                new GCMParameterSpec(GCM_TAG_BITS, iv);
        cipher.init(Cipher.DECRYPT_MODE, key, paramSpec);

        byte[] plaintext = cipher.doFinal(ciphertext);
        return new String(plaintext, "UTF-8");
    }

    // ── PBKDF2 KEY DERIVATION ──
    // Password + salt → 100,000 SHA-256 rounds → AES-256 key
    public static SecretKey deriveKey(
            String password,
            byte[] salt) throws Exception {

        PBEKeySpec spec = new PBEKeySpec(
                password.toCharArray(),
                salt,
                ITERATIONS,
                KEY_LENGTH
        );

        SecretKeyFactory factory =
                SecretKeyFactory.getInstance(
                "PBKDF2WithHmacSHA256");

        byte[] keyBytes = factory
                .generateSecret(spec)
                .getEncoded();

        spec.clearPassword(); // Security: clear from memory

        return new SecretKeySpec(keyBytes, "AES");
    }

    // ── GENERATE RANDOM BYTES ──
    private static byte[] generateRandom(int length) {
        byte[] bytes = new byte[length];
        new SecureRandom().nextBytes(bytes);
        return bytes;
    }

    // ── BYTES TO HEX STRING ──
    public static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X ", b));
        }
        return sb.toString().trim();
    }

    // ── BYTES TO BASE64 ──
    public static String toBase64(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }

    // ── BASE64 TO BYTES ──
    public static byte[] fromBase64(String b64) {
        return Base64.getDecoder().decode(b64);
    }

    // ── SCORE PASSWORD STRENGTH ──
    public static String scorePassword(String pwd) {
        int score = 0;
        if (pwd.length() >= 8)              score += 20;
        if (pwd.length() >= 12)             score += 15;
        if (pwd.length() >= 16)             score += 10;
        if (pwd.matches(".*[A-Z].*"))       score += 15;
        if (pwd.matches(".*[a-z].*"))       score += 10;
        if (pwd.matches(".*[0-9].*"))       score += 15;
        if (pwd.matches(".*[^A-Za-z0-9].*")) score += 15;

        if (score < 30) return "WEAK";
        if (score < 55) return "MODERATE";
        if (score < 75) return "STRONG";
        return "FORTRESS";
    }

    // ── CALCULATE ENTROPY BITS ──
    public static double calculateEntropy(String pwd) {
        int charsetSize = 0;
        if (pwd.matches(".*[a-z].*"))        charsetSize += 26;
        if (pwd.matches(".*[A-Z].*"))        charsetSize += 26;
        if (pwd.matches(".*[0-9].*"))        charsetSize += 10;
        if (pwd.matches(".*[^A-Za-z0-9].*")) charsetSize += 32;
        if (charsetSize == 0) return 0;
        return pwd.length() *
                (Math.log(charsetSize) / Math.log(2));
    }
}