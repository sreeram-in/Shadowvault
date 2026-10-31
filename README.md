# ShadowVault

ShadowVault contains a static browser app and a separate Java command-line app. The website has no server or database: image encryption and the browser vault run locally in your browser.

## Run The Website Locally

From the project folder in PowerShell:

```powershell
py -m http.server 8000
```

Open <http://localhost:8000>. Stop the server with `Ctrl+C`. If `py` is not available, use `python -m http.server 8000`.

## Use The Website

- **Encode:** Choose an opaque carrier image, enter a message and matching master passwords, adjust PBKDF2 iterations if needed, select **ENCRYPT & INJECT INTO IMAGE**, then download the PNG. Keep the password and PNG; both are needed to recover the message.
- **Decode:** Select the PNG produced by ShadowVault, enter the same password, and select **EXTRACT & DECRYPT**. A wrong password or damaged/unsupported image displays an error, not sample credentials.
- **Visualiser:** Enter a demonstration message and password, optionally choose an image, then select **ANALYSE** to inspect the encryption steps.
- **Vault:** Create a browser-local vault with a master password of at least 12 characters. Add entries manually or use the generator, then search, reveal, copy, or delete entries. Use **ENCRYPTED BACKUP** to download a backup and **IMPORT ENCRYPTED BACKUP** to restore it.
- **Password generator:** Choose character groups and a length from 8 to 64, then select **GENERATE**. **COPY** copies the generated value and attempts to clear the clipboard after 30 seconds.
- **Panic / session lock:** These clear visible sensitive fields and lock the browser vault. They do not erase downloaded files or browser backups.

The browser vault is encrypted with AES-GCM and stored in this browser's local storage. It does not sync across browsers or devices. Export a backup before clearing site data or changing browsers. The backup is encrypted, but anyone with the file and master password can open it; there is no password recovery.

This project has not undergone a security audit. Steganography can be detected, and the panic/blur behavior is a screen-clearing convenience, not a way to erase evidence. Do not use this project as the sole storage for important credentials or commit real passwords, carrier images, or backups to GitHub.

## Run The Java CLI

Install JDK 17 and Maven, then run these commands from the project root:

```powershell
mvn clean compile
mvn exec:java
```

The CLI can create or open a vault image, add/list/search/delete entries, run a health check, and generate passwords. Use PNG for the output image. The Java sources and browser app are separate implementations; the Java CLI does not run as the website's backend.

## Publish On GitHub Pages

GitHub Pages can host this static website directly; no build step or Python server is needed online.

1. Install [Git for Windows](https://git-scm.com/download/win) or [GitHub Desktop](https://desktop.github.com/). This computer currently does not have the `git` command available.
2. On GitHub, create a new empty repository. Do not add a README, license, or `.gitignore` there because this project already has local files for those.
3. In PowerShell, open this folder and run:

   ```powershell
   git --version
   git init -b main
   git add .
   git commit -m "Prepare ShadowVault for GitHub Pages"
   git remote add origin https://github.com/USERNAME/REPOSITORY.git
   git push -u origin main
   ```

   Replace `USERNAME` and `REPOSITORY` with the account and repository name. GitHub may open a browser sign-in during the first push.
4. On GitHub, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then select **Save**.
5. After GitHub finishes deployment, the site will be at `https://USERNAME.github.io/REPOSITORY/`. For a repository named `USERNAME.github.io`, the address is `https://USERNAME.github.io/`.

To publish later changes, run `git add .`, `git commit -m "Describe the change"`, and `git push`. A public repository makes the website source public; never commit secrets or vault backup files.