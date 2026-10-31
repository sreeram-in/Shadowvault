package shadowvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.io.*;
import java.util.*;
import java.time.*;
import java.time.format.DateTimeFormatter;

/**
 * VaultManager.java
 * Manages the password vault
 * Handles CRUD operations + save/load to stego image
 */
public class VaultManager {

    // ── VAULT ENTRY (inner class) ──
    public static class VaultEntry {

        private String  site;
        private String  username;
        private String  password;
        private String  notes;
        private String  created;
        private String  expires;
        private boolean favourite;

        // Default constructor for Jackson
        public VaultEntry() {}

        public VaultEntry(
                String site,
                String username,
                String password,
                String notes) {

            this.site      = site;
            this.username  = username;
            this.password  = password;
            this.notes     = notes;
            this.created   = LocalDateTime.now().format(
                DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            // Expires 90 days from now
            this.expires   = LocalDateTime.now()
                .plusDays(90)
                .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            this.favourite = false;
        }

        // ── GETTERS ──
        public String  getSite()      { return site;      }
        public String  getUsername()  { return username;  }
        public String  getPassword()  { return password;  }
        public String  getNotes()     { return notes;     }
        public String  getCreated()   { return created;   }
        public String  getExpires()   { return expires;   }
        public boolean isFavourite()  { return favourite; }

        // ── SETTERS ──
        public void setSite(String site)           { this.site = site;           }
        public void setUsername(String username)   { this.username = username;   }
        public void setPassword(String password)   { this.password = password;   }
        public void setNotes(String notes)         { this.notes = notes;         }
        public void setCreated(String created)     { this.created = created;     }
        public void setExpires(String expires)     { this.expires = expires;     }
        public void setFavourite(boolean fav)      { this.favourite = fav;       }

        @Override
        public String toString() {
            return String.format(
                "%-20s %-25s %s",
                site, username,
                expires != null
                    ? "Expires: " + expires.substring(0,10)
                    : "No expiry"
            );
        }
    }

    // ── VAULT CONTAINER ──
    public static class VaultContainer {
        public String       version  = "2.4.0";
        public String       created;
        public List<VaultEntry> entries  = new ArrayList<>();

        public VaultContainer() {
            this.created = LocalDateTime.now().format(
                DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        }
    }

    // ── STATE ──
    private VaultContainer  vault;
    private File            currentImageFile;
    private String          currentPassword;
    private static final ObjectMapper mapper;

    static {
        mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    // ── CONSTRUCTOR ──
    public VaultManager() {
        this.vault = new VaultContainer();
    }

    // ══════════════════════════════════════
    //  CRUD OPERATIONS
    // ══════════════════════════════════════

    // ── ADD ENTRY ──
    public void addEntry(
            String site,
            String username,
            String password,
            String notes) {

        VaultEntry entry = new VaultEntry(
            site, username, password, notes);
        vault.entries.add(entry);

        System.out.println(
            "\n✓ Entry added successfully:");
        System.out.println("  Site:     " + site);
        System.out.println("  Username: " + username);
        System.out.println("  Strength: " +
            CryptoEngine.scorePassword(password));
    }

    // ── GET ENTRY BY SITE ──
    public VaultEntry getEntry(String site) {
        return vault.entries.stream()
            .filter(e -> e.getSite()
                .toLowerCase()
                .contains(site.toLowerCase()))
            .findFirst()
            .orElse(null);
    }

    // ── DELETE ENTRY ──
    public boolean deleteEntry(String site) {
        boolean removed = vault.entries.removeIf(
            e -> e.getSite()
                .equalsIgnoreCase(site));
        if (removed) {
            System.out.println("✓ Entry deleted: " + site);
        } else {
            System.out.println("✗ Entry not found: " + site);
        }
        return removed;
    }

    // ── UPDATE PASSWORD ──
    public boolean updatePassword(
            String site, String newPassword) {
        VaultEntry entry = getEntry(site);
        if (entry == null) {
            System.out.println("✗ Site not found: " + site);
            return false;
        }
        entry.setPassword(newPassword);
        System.out.println(
            "✓ Password updated for: " + site);
        return true;
    }

    // ── LIST ALL ENTRIES ──
    public void listEntries() {
        if (vault.entries.isEmpty()) {
            System.out.println("\nVault is empty.");
            return;
        }

        System.out.println("\n╔══ VAULT ENTRIES ══════════════════════════╗");
        System.out.printf(
            "║ %-3s %-20s %-20s %s%n",
            "#", "SITE", "USERNAME", "EXPIRES");
        System.out.println(
            "╠═══════════════════════════════════════════╣");

        for (int i = 0; i < vault.entries.size(); i++) {
            VaultEntry e = vault.entries.get(i);
            System.out.printf(
                "║ %-3d %-20s %-20s %s%n",
                i + 1,
                e.getSite(),
                e.getUsername(),
                e.getExpires() != null
                    ? e.getExpires().substring(0,10)
                    : "N/A"
            );
        }

        System.out.println("╚═══════════════════════════════════════════╝");
        System.out.println(
            "Total: " + vault.entries.size() + " entries");
    }

    // ── SEARCH ENTRIES ──
    public List<VaultEntry> search(String query) {
        String q = query.toLowerCase();
        List<VaultEntry> results = new ArrayList<>();
        for (VaultEntry e : vault.entries) {
            if (e.getSite().toLowerCase().contains(q) ||
                e.getUsername().toLowerCase().contains(q) ||
                (e.getNotes() != null &&
                 e.getNotes().toLowerCase().contains(q))) {
                results.add(e);
            }
        }
        return results;
    }

    // ── HEALTH CHECK ──
    public void healthCheck() {
        System.out.println("\n╔══ VAULT HEALTH CHECK ══╗");

        int issues = 0;
        Set<String> seenPasswords = new HashSet<>();

        for (VaultEntry e : vault.entries) {

            // Check weak password
            if (e.getPassword().length() < 8) {
                System.out.println(
                    "⚠ WEAK PASSWORD: " +
                    e.getSite() + " (too short)");
                issues++;
            }

            // Check reused password
            if (seenPasswords.contains(e.getPassword())) {
                System.out.println(
                    "⚠ REUSED PASSWORD: " +
                    e.getSite());
                issues++;
            }
            seenPasswords.add(e.getPassword());

            // Check common passwords
            List<String> common = Arrays.asList(
                "password", "123456", "qwerty",
                "abc123", "password123", "admin");
            if (common.contains(
                    e.getPassword().toLowerCase())) {
                System.out.println(
                    "⚠ COMMON PASSWORD: " +
                    e.getSite());
                issues++;
            }
        }

        if (issues == 0) {
            System.out.println(
                "✓ All passwords look healthy!");
        } else {
            System.out.println(
                "\nTotal issues found: " + issues);
        }
        System.out.println("╚═══════════════════════╝");
    }

    // ══════════════════════════════════════
    //  SAVE & LOAD
    // ══════════════════════════════════════

    // ── SAVE VAULT TO STEGO IMAGE ──
    public void save(
            File carrierImage,
            File outputFile,
            String masterPassword) throws Exception {

        System.out.println("\n▶ Saving vault...");

        // Step 1: Serialize vault to JSON
        String json = mapper.writeValueAsString(vault);
        System.out.println(
            "▶ Serialized: " +
            vault.entries.size() + " entries");

        // Step 2: Encrypt JSON
        byte[] encrypted = CryptoEngine.encrypt(
            json, masterPassword);
        System.out.println(
            "▶ Encrypted: " +
            encrypted.length + " bytes");

        // Step 3: Hide in image
        File stegoOutput = outputFile;
        if (!outputFile.getName().toLowerCase(Locale.ROOT).endsWith(".png")) {
            stegoOutput = new File(outputFile.getPath() + ".png");
        }
        StegoEngine.encode(
            carrierImage, encrypted, stegoOutput);

        // Remember for quick save
        this.currentImageFile = stegoOutput;
        this.currentPassword  = masterPassword;

        System.out.println(
            "\n✓ VAULT SAVED SUCCESSFULLY");
        System.out.println(
            "  File:    " + stegoOutput.getName());
        System.out.println(
            "  Entries: " + vault.entries.size());
        System.out.println(
            "  Size:    " + encrypted.length + " bytes");
    }

    // ── LOAD VAULT FROM STEGO IMAGE ──
    public void load(
            File stegoImage,
            String masterPassword) throws Exception {

        System.out.println("\n▶ Loading vault...");

        // Step 1: Extract hidden bytes from image
        byte[] extracted = StegoEngine.decode(stegoImage);
        System.out.println(
            "▶ Extracted: " +
            extracted.length + " bytes");

        // Step 2: Decrypt
        // Throws AEADBadTagException if wrong password
        String json = CryptoEngine.decrypt(
            extracted, masterPassword);
        System.out.println("▶ Decrypted successfully");

        // Step 3: Deserialize JSON to vault
        vault = mapper.readValue(json,
            VaultContainer.class);

        this.currentImageFile = stegoImage;
        this.currentPassword  = masterPassword;

        System.out.println(
            "\n✓ VAULT LOADED SUCCESSFULLY");
        System.out.println(
            "  Entries: " + vault.entries.size());
        System.out.println(
            "  Created: " + vault.created);
    }

    // ── QUICK SAVE (reuse current image + password) ──
    public void quickSave() throws Exception {
        if (currentImageFile == null ||
            currentPassword == null) {
            throw new Exception(
                "No vault currently open. " +
                "Use save() first.");
        }
        save(currentImageFile,
             currentImageFile,
             currentPassword);
    }

    // ── EXPORT ENCRYPTED BACKUP ──
    public void exportEncryptedBackup(File outputFile)
            throws Exception {
        if (currentPassword == null) {
            throw new Exception("Unlock the vault before exporting a backup.");
        }
        byte[] encrypted = CryptoEngine.encrypt(
            mapper.writeValueAsString(vault), currentPassword);
        Map<String, String> backup = new LinkedHashMap<>();
        backup.put("format", "shadowvault-java-encrypted-backup-v1");
        backup.put("payload", Base64.getEncoder().encodeToString(encrypted));
        mapper.writeValue(outputFile, backup);
        System.out.println(
            "✓ Exported to: " + outputFile.getName());
    }

    // ── GET ENTRY COUNT ──
    public int getEntryCount() {
        return vault.entries.size();
    }

    // ── IS EMPTY ──
    public boolean isEmpty() {
        return vault.entries.isEmpty();
    }

    // ── GET ALL ENTRIES ──
    public List<VaultEntry> getAllEntries() {
        return Collections.unmodifiableList(
            vault.entries);
    }
}
