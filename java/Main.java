package shadowvault;

import org.jline.terminal.Terminal;
import org.jline.terminal.TerminalBuilder;
import org.jline.reader.*;
import org.jline.reader.impl.completer.NullCompleter;
import java.io.File;

/**
 * Main.java
 * CLI Entry Point for ShadowVault
 * Interactive terminal menu with masked password input
 */
public class Main {

    // ── STATE ──
    private static VaultManager vault =
            new VaultManager();
    private static File    currentCarrier = null;
    private static File    currentOutput  = null;
    private static String  currentPwd     = null;
    private static boolean vaultOpen      = false;

    public static void main(String[] args) throws Exception {

        printBanner();

        // Setup JLine terminal for masked input
        Terminal terminal = TerminalBuilder.builder()
                .system(true)
                .build();

        LineReader reader = LineReaderBuilder.builder()
                .terminal(terminal)
                .completer(new NullCompleter())
                .build();

        System.out.println(
            "\nWelcome, Operative. " +
            "All sessions are encrypted.\n");

        // Main menu loop
        while (true) {
            printMenu(vaultOpen);
            String choice = reader
                .readLine("\n  Enter choice > ")
                .trim();

            switch (choice) {

                case "1" -> createVault(reader);
                case "2" -> openVault(reader);
                case "3" -> {
                    if (requireOpen()) addPassword(reader);
                }
                case "4" -> {
                    if (requireOpen()) getPassword(reader);
                }
                case "5" -> {
                    if (requireOpen()) vault.listEntries();
                }
                case "6" -> {
                    if (requireOpen()) searchPasswords(reader);
                }
                case "7" -> {
                    if (requireOpen()) deletePassword(reader);
                }
                case "8" -> generatePasswordMenu(reader);
                case "9" -> {
                    if (requireOpen()) vault.healthCheck();
                }
                case "0" -> {
                    System.out.println(
                        "\n🔒 Vault locked. " +
                        "Stay in the shadows.\n");
                    System.exit(0);
                }
                default -> System.out.println(
                    "  ✗ Invalid choice. Try again.");
            }
        }
    }

    // ══════════════════════════════════════
    //  MENU ACTIONS
    // ══════════════════════════════════════

    // ── CREATE NEW VAULT ──
    static void createVault(LineReader reader)
            throws Exception {

        System.out.println("\n── CREATE NEW VAULT ──");
        String carrierPath = reader.readLine(
            "  Carrier image path (.png/.jpg): ");
        String outputPath = reader.readLine(
            "  Output image path (.png):       ");
        String pwd = reader.readLine(
            "  Master password:                ", '*');
        String pwd2 = reader.readLine(
            "  Confirm password:               ", '*');

        if (!pwd.equals(pwd2)) {
            System.out.println("  ✗ Passwords do not match");
            return;
        }

        String strength =
            CryptoEngine.scorePassword(pwd);
        System.out.println(
            "  Password strength: " + strength);

        if (strength.equals("WEAK")) {
            System.out.println(
                "  ⚠ Warning: Weak password. " +
                "Consider using a stronger one.");
        }

        vault = new VaultManager();
        currentCarrier = new File(carrierPath);
        currentOutput  = new File(outputPath);
        currentPwd     = pwd;

        // Save empty vault to image
        vault.save(currentCarrier,
                   currentOutput, currentPwd);
        vaultOpen = true;
    }

    // ── OPEN EXISTING VAULT ──
    static void openVault(LineReader reader)
            throws Exception {

        System.out.println("\n── OPEN VAULT ──");
        String imagePath = reader.readLine(
            "  Stego image path: ");
        String pwd = reader.readLine(
            "  Master password:  ", '*');

        vault = new VaultManager();
        currentCarrier = null;
        currentOutput = null;
        currentPwd = null;
        vaultOpen = false;

        try {
            vault.load(new File(imagePath), pwd);
            currentOutput = new File(imagePath);
            currentPwd    = pwd;
            vaultOpen     = true;
            System.out.println(
                "\n✓ Vault unlocked successfully.");
        } catch (Exception e) {
            System.out.println(
                "\n✗ DECRYPTION FAILED: " +
                "Wrong password or invalid image.");
        }
    }

    // ── ADD PASSWORD ──
    static void addPassword(LineReader reader)
            throws Exception {

        System.out.println("\n── ADD PASSWORD ──");
        String site  = reader.readLine("  Site/Service:  ");
        String user  = reader.readLine("  Username:      ");

        // Ask if they want to generate
        String genChoice = reader.readLine(
            "  Generate password? (y/n): ");
        String pwd;

        if (genChoice.equalsIgnoreCase("y")) {
            pwd = PasswordGenerator.generate(
                20, true, true, true, true);
            System.out.println(
                "  Generated: " + pwd);
            System.out.println(
                "  Strength:  " +
                PasswordGenerator.scoreStrength(pwd));
        } else {
            pwd = reader.readLine(
                "  Password:      ", '*');
        }

        String notes = reader.readLine(
            "  Notes (optional): ");

        vault.addEntry(site, user, pwd, notes);

        // Auto-save
        vault.quickSave();
        System.out.println("  ✓ Entry saved to vault.");
    }

    // ── GET PASSWORD ──
    static void getPassword(LineReader reader)
            throws Exception {

        System.out.println("\n── GET PASSWORD ──");
        String site = reader.readLine("  Site name: ");

        VaultManager.VaultEntry entry =
            vault.getEntry(site);

        if (entry == null) {
            System.out.println(
                "  ✗ No entry found for: " + site);
            return;
        }

        System.out.println("\n  ╔══ ENTRY FOUND ══╗");
        System.out.println("  Site:     " + entry.getSite());
        System.out.println("  Username: " + entry.getUsername());
        System.out.println("  Password: " + entry.getPassword());
        if (entry.getNotes() != null &&
            !entry.getNotes().isEmpty()) {
            System.out.println(
                "  Notes:    " + entry.getNotes());
        }
        System.out.println("  Expires:  " +
            (entry.getExpires() != null
                ? entry.getExpires().substring(0,10)
                : "N/A"));
        System.out.println("  ╚═════════════════╝");
    }

    // ── SEARCH ──
    static void searchPasswords(LineReader reader)
            throws Exception {

        System.out.println("\n── SEARCH ──");
        String query = reader.readLine("  Search query: ");

        java.util.List<VaultManager.VaultEntry> results =
            vault.search(query);

        if (results.isEmpty()) {
            System.out.println(
                "  No results for: " + query);
            return;
        }

        System.out.println(
            "\n  Found " + results.size() + " result(s):");
        results.forEach(e ->
            System.out.println(
                "  → " + e.getSite() +
                " (" + e.getUsername() + ")"));
    }

    // ── DELETE PASSWORD ──
    static void deletePassword(LineReader reader)
            throws Exception {

        System.out.println("\n── DELETE ENTRY ──");
        String site = reader.readLine("  Site to delete: ");
        String confirm = reader.readLine(
            "  Confirm delete '" + site + "'? (yes/no): ");

        if (confirm.equalsIgnoreCase("yes")) {
            vault.deleteEntry(site);
            vault.quickSave();
        } else {
            System.out.println("  Cancelled.");
        }
    }

    // ── GENERATE PASSWORD MENU ──
    static void generatePasswordMenu(LineReader reader)
            throws Exception {

        System.out.println("\n── PASSWORD GENERATOR ──");
        String lenStr = reader.readLine(
            "  Length (8-64) [20]: ");
        int len;
        try {
            len = lenStr.isEmpty()
                ? 20 : Integer.parseInt(lenStr.trim());
        } catch (NumberFormatException e) {
            System.out.println("  ✗ Enter a whole number from 8 to 64.");
            return;
        }
        if (len < 8 || len > 64) {
            System.out.println("  ✗ Password length must be from 8 to 64.");
            return;
        }

        String useUpper = reader.readLine(
            "  Uppercase? (y/n) [y]: ");
        String useLower = reader.readLine(
            "  Lowercase? (y/n) [y]: ");
        String useDigits = reader.readLine(
            "  Digits? (y/n) [y]: ");
        String useSymbols = reader.readLine(
            "  Symbols? (y/n) [y]: ");

        boolean upper   = !useUpper.equalsIgnoreCase("n");
        boolean lower   = !useLower.equalsIgnoreCase("n");
        boolean digits  = !useDigits.equalsIgnoreCase("n");
        boolean symbols = !useSymbols.equalsIgnoreCase("n");

        // Generate 5 options
        System.out.println("\n  Generated passwords:");
        for (int i = 1; i <= 5; i++) {
            String pwd = PasswordGenerator.generate(
                len, upper, lower, digits, symbols);
            double entropy =
                PasswordGenerator.entropy(pwd);
            System.out.printf(
                "  %d. %s  [%s | %.0f bits]%n",
                i, pwd,
                PasswordGenerator.scoreStrength(pwd),
                entropy);
        }
    }

    // ══════════════════════════════════════
    //  UI HELPERS
    // ══════════════════════════════════════

    static boolean requireOpen() {
        if (!vaultOpen) {
            System.out.println(
                "\n  ✗ No vault open. " +
                "Create or open a vault first.");
            return false;
        }
        return true;
    }

    static void printBanner() {
        System.out.println("\n");
        System.out.println(
            "  ╔══════════════════════════════════════╗");
        System.out.println(
            "  ║         S H A D O W V A U L T        ║");
        System.out.println(
            "  ║    Steganographic Password Manager   ║");
        System.out.println(
            "  ║              v2.4.0                  ║");
        System.out.println(
            "  ╚══════════════════════════════════════╝");
    }

    static void printMenu(boolean vaultOpen) {
        System.out.println(
            "\n  ┌──────────────────────────────┐");
        System.out.println(
            "  │  VAULT: " +
            (vaultOpen ? "🔓 UNLOCKED          " :
                         "🔒 LOCKED            ") +
            "│");
        System.out.println(
            "  ├──────────────────────────────┤");
        System.out.println("  │  1. Create New Vault         │");
        System.out.println("  │  2. Open Existing Vault      │");
        System.out.println("  │  3. Add Password             │");
        System.out.println("  │  4. Get Password             │");
        System.out.println("  │  5. List All Entries         │");
        System.out.println("  │  6. Search                   │");
        System.out.println("  │  7. Delete Entry             │");
        System.out.println("  │  8. Generate Password        │");
        System.out.println("  │  9. Health Check             │");
        System.out.println("  │  0. Lock & Exit              │");
        System.out.println(
            "  └──────────────────────────────┘");
    }
}
