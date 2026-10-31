# ShadowVault

ShadowVault contains a static browser app and a separate Java command-line app. The website has no server or database: image encryption and the browser vault run locally in your browser.

## Live Website

[Open ShadowVault](https://sreeram-in.github.io/Shadowvault/)

## Project Partners

- [Akshay K A](https://github.com/akshay-ka-pkd)
- P S Athul Krishna
- [Swaroop Krishnan M](https://github.com/godkira8600)
- Althaf

## Run The Website Locally

From the project folder in PowerShell:

~~~powershell
py -m http.server 8000
~~~

Open <http://localhost:8000>. Stop the server with Ctrl+C. If py is not available, use python -m http.server 8000.

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

~~~powershell
mvn clean compile
mvn exec:java
~~~

The CLI can create or open a vault image, add/list/search/delete entries, run a health check, and generate passwords. Use PNG for the output image. The Java sources and browser app are separate implementations; the Java CLI does not run as the website's backend.

## Publish On GitHub Pages

GitHub Pages hosts this static website directly; no build step or Python server is needed online.

1. Create a GitHub repository and upload the project files, preserving the css/, js/, and java/ folders. Keep index.html at the repository root. Do not upload the .git folder.
2. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select main and /(root), then select **Save**.
3. After deployment, a project site is available at https://USERNAME.github.io/REPOSITORY/. For a repository named USERNAME.github.io, the address is https://USERNAME.github.io/.

A public repository makes the website source public. Never commit secrets, real credentials, or vault backups.
