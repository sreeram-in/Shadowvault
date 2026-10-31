package shadowvault;

import java.security.SecureRandom;

/**
 * PasswordGenerator.java
 * Cryptographically secure password generator
 * Uses SecureRandom — NOT Math.random()
 */
public class PasswordGenerator {

    // ── CHARACTER SETS ──
    private static final String UPPER =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final String LOWER =
        "abcdefghijklmnopqrstuvwxyz";
    private static final String DIGITS =
        "0123456789";
    private static final String SYMBOLS =
        "!@#$%^&*()-_=+[]{}|;:,.<>?";

    // SecureRandom is cryptographically strong
    private static final SecureRandom RANDOM =
        new SecureRandom();

    // ── GENERATE PASSWORD ──
    public static String generate(
            int length,
            boolean useUpper,
            boolean useLower,
            boolean useDigits,
            boolean useSymbols) {

        if (length < 8 || length > 64) {
            throw new IllegalArgumentException(
                "Password length must be between 8 and 64.");
        }

        // Build charset from selected options
        StringBuilder charset = new StringBuilder();
        if (useUpper)   charset.append(UPPER);
        if (useLower)   charset.append(LOWER);
        if (useDigits)  charset.append(DIGITS);
        if (useSymbols) charset.append(SYMBOLS);

        // Fallback if nothing selected
        if (charset.length() == 0) {
            charset.append(LOWER);
        }

        String cs = charset.toString();

        // Generate password using SecureRandom
        StringBuilder pwd = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            pwd.append(cs.charAt(
                RANDOM.nextInt(cs.length())));
        }

        return pwd.toString();
    }

    // ── SCORE PASSWORD STRENGTH ──
    public static String scoreStrength(String pwd) {
        int score = 0;

        // Length scoring
        if (pwd.length() >= 8)  score += 20;
        if (pwd.length() >= 12) score += 15;
        if (pwd.length() >= 16) score += 10;
        if (pwd.length() >= 20) score += 5;

        // Character variety scoring
        if (pwd.matches(".*[A-Z].*"))        score += 15;
        if (pwd.matches(".*[a-z].*"))        score += 10;
        if (pwd.matches(".*[0-9].*"))        score += 15;
        if (pwd.matches(".*[^A-Za-z0-9].*")) score += 10;

        if (score < 30) return "WEAK";
        if (score < 50) return "FAIR";
        if (score < 70) return "STRONG";
        if (score < 85) return "VERY STRONG";
        return               "FORTRESS";
    }

    // ── CALCULATE ENTROPY BITS ──
    public static double entropy(String pwd) {
        int charsetSize = 0;
        if (pwd.matches(".*[a-z].*"))        charsetSize += 26;
        if (pwd.matches(".*[A-Z].*"))        charsetSize += 26;
        if (pwd.matches(".*[0-9].*"))        charsetSize += 10;
        if (pwd.matches(".*[^A-Za-z0-9].*")) charsetSize += 32;
        if (charsetSize == 0) return 0;
        return pwd.length() *
            (Math.log(charsetSize) / Math.log(2));
    }

    // ── ESTIMATE CRACK TIME ──
    public static String crackTime(String pwd) {
        double entropyBits = entropy(pwd);
        // Assume 10 billion guesses per second (GPU)
        double guessesPerSec = 1e10;
        double seconds = Math.pow(2, entropyBits)
            / guessesPerSec;

        if (seconds < 1)         return "Instant";
        if (seconds < 60)        return
            Math.round(seconds) + " seconds";
        if (seconds < 3600)      return
            Math.round(seconds / 60) + " minutes";
        if (seconds < 86400)     return
            Math.round(seconds / 3600) + " hours";
        if (seconds < 2592000)   return
            Math.round(seconds / 86400) + " days";
        if (seconds < 31536000)  return
            Math.round(seconds / 2592000) + " months";
        if (seconds < 3.15e9)    return
            Math.round(seconds / 31536000) + " years";
        return "∞ centuries";
    }

    // ── PRINT ANALYSIS ──
    public static void printAnalysis(String pwd) {
        System.out.println("\n  ╔══ PASSWORD ANALYSIS ══╗");
        System.out.println(
            "  Password:  " + pwd);
        System.out.println(
            "  Length:    " + pwd.length());
        System.out.println(
            "  Strength:  " + scoreStrength(pwd));
        System.out.printf(
            "  Entropy:   %.1f bits%n", entropy(pwd));
        System.out.println(
            "  Crack time: " + crackTime(pwd));
        System.out.println("  ╚═══════════════════════╝");
    }
}