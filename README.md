<div align="center">

# SHADOWVAULT

### One message. One image. One key.

Encrypt a message, hide its ciphertext inside an image, and keep the key with you.

[Launch ShadowVault](https://sreeram-in.github.io/Shadowvault/) · [How to use it](#a-quick-tour) · [Meet the team](#project-partners)

![Hosted on GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-1f6feb?logo=githubpages&logoColor=white)
![Encryption](https://img.shields.io/badge/Encryption-AES--256--GCM-087f5b)
![Java CLI](https://img.shields.io/badge/CLI-Java%2017-e76f00?logo=openjdk&logoColor=white)

</div>

> **A note on security:** ShadowVault is an educational project, not an audited password manager. LSB steganography can be detected. Do not rely on it to protect important credentials or to conceal activity.

## The idea

Encryption makes a message unreadable without its password. Steganography gives the encrypted bytes an ordinary-looking carrier: a PNG image. ShadowVault brings both steps into one browser workflow, alongside a small local password vault and a separate Java CLI.

The goal is hands-on exploration of the pipeline, not a promise of invisibility.

## What you can do

- **Hide a message:** Encrypt text with PBKDF2-derived AES-256-GCM, then embed the ciphertext in an opaque image's RGB least-significant bits.
- **Recover a message:** Load a ShadowVault PNG and decrypt it with the same password. A wrong password or damaged image returns an error.
- **See the process:** Explore the visualiser's stages from plaintext through encryption and pixel changes.
- **Keep a local vault:** Save entries encrypted in this browser, generate passwords, and export or import an encrypted backup.

## A quick tour

### Hide a message

1. Open [ShadowVault](https://sreeram-in.github.io/Shadowvault/) and choose **Encode**.
2. Select an **opaque** carrier image, enter a message, and set and confirm a strong password.
3. Choose **ENCRYPT & INJECT INTO IMAGE**, then download the resulting PNG.
4. Keep both the PNG and password. You need both to decode the message.

### Read it back

Choose **Decode**, upload the ShadowVault PNG, enter its password, and select **EXTRACT & DECRYPT**.

### Explore or manage

Use **Visualiser** to inspect a demonstration run. In **Vault**, create a browser-local vault with a master password of at least 12 characters, then add, search, reveal, copy, or delete entries. Export an encrypted backup before clearing browser data or moving to another browser.

## Under the hood

`Password + salt` → `PBKDF2 / SHA-256` → `AES-256-GCM` → `RGB LSBs` → `PNG`

- Each encoded message gets a random salt and IV; AES-GCM authenticates the ciphertext.
- The browser uses the Web Crypto API. The carrier needs to be fully opaque because transparent pixels may lose their RGB values during image processing.
- PNG is lossless, which preserves the embedded bits. Re-saving as JPEG can destroy them.
- A browser vault is encrypted in local storage on that browser only. It does not sync, and there is no master-password recovery.

## Run it locally

The website is static; it needs no backend or build step. From the project folder in PowerShell:

~~~powershell
py -m http.server 8000
~~~

Visit <http://localhost:8000>. Stop the server with `Ctrl+C`. If `py` is unavailable, use `python -m http.server 8000`.

## Java CLI

The Java sources are a separate command-line implementation, not a backend for the website. Install JDK 17 and Maven, then run from the project root:

~~~powershell
mvn clean compile
mvn exec:java
~~~

The menu can create or open an image-backed vault, add/list/search/delete entries, run a health check, and generate passwords. Use PNG for vault images.

## Project map

~~~text
index.html   Browser interface
css/         Styles
js/          Browser encryption, steganography, vault, and visualiser
java/        Java CLI and engines
pom.xml      Maven build for the Java CLI
~~~

## Project partners

- [Akshay K A](https://github.com/akshay-ka-pkd)
- P S Athul Krishna
- [Swaroop Krishnan M](https://github.com/godkira8600)
- Althaf

## Project limits

The browser vault's encrypted backup is portable, but anyone with the backup and its master password can open it. The vault is stored per browser and will be lost if site data is cleared without a backup. The panic and blur controls clear or hide information on screen; they do not erase files or browser history.

Never commit real passwords, private carrier images, or vault backups to this public repository.
