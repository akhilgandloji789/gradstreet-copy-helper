<p align="center">
  <img src="logo.png" width="160" height="160" alt="GSAK - Gradstreet Copy Helper" style="border-radius: 28px; box-shadow: 0 12px 36px rgba(0,0,0,0.5);" />
</p>

<h1 align="center">Gradstreet Copy Helper (GSAK)</h1>

<p align="center">
  <strong>The ultra-stealth, proctor-safe Chrome extension for Gradstreet assessment tests.</strong><br>
  Instant drag-and-drop question extraction & seamless Monaco editor code injection without touching your clipboard.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.4.0-38bdf8?style=flat-square" alt="Version 2.4.0" />
  <img src="https://img.shields.io/badge/manifest-v3-10b981?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/clipboard_footprint-zero-emerald?style=flat-square" alt="Zero Clipboard Footprint" />
  <img src="https://img.shields.io/badge/proctor-safe-blue?style=flat-square" alt="Proctor Safe" />
  <img src="https://img.shields.io/badge/license-MIT-slate?style=flat-square" alt="License MIT" />
</p>

---

## 🌟 Overview

Online assessment platforms like **Gradstreet** (`gradstreet.instacks.co`) employ aggressive anti-copying techniques:
1. They monitor OS-level clipboard events (`copy`, `cut`, `paste`, `navigator.clipboard`).
2. They set the Microsoft Monaco code editor's internal `<textarea>` to read-only, silently blocking standard `Ctrl+V` code paste.
3. They use dynamic single-page application (SPA) layouts where question DOM selectors constantly shift across coding problems, MCQs, and full-screen proctored modes.

**Gradstreet Copy Helper (GSAK)** was engineered to solve all three problems with zero compromise on safety or convenience.

---

## ✨ Key Features

### 🛡️ 1. Zero Clipboard Footprint (100% Proctor-Safe)
- **No Clipboard Traps**: Completely eliminates `clipboardRead` and `clipboardWrite` permissions.
- **No Browser Permission Alerts**: Chrome will **never** display the warning:  
  `"gradstreet.instacks.co wants to: See text and images copied to the clipboard"`.
- **Protected Solution Code**: If you have solution code on your clipboard, extracting questions will **never** erase or overwrite it.

### ⠿ 2. Native Multi-MIME Drag & Drop
- Click the extension icon to reveal a glassy drag card: `⠿ Drag Question to Any App`.
- Click and drag directly into **ChatGPT, Notepad, VS Code, Word, or another browser window**.
- Packaged with standard `text/plain`, Windows OLE `Text`, and rich `text/html` payloads for maximum cross-application compatibility.

### 🖤 3. Frameless Transparent Glassy Black Theme
- Modern glassmorphism UI built with obsidian translucent glass (`rgba(8, 10, 15, 0.92)`), `backdrop-filter: blur(28px)`, and neon cyan glowing accents.
- Seamlessly blends into your browser with zero outer border frames or obtrusive badges.

### ⚡ 4. Direct Monaco Editor Integration (`Ctrl + V` / `Cmd + V`)
- Executes in the webpage's **`MAIN` execution world**, bypassing strict Content Security Policies (CSP).
- Intercepts native paste events in the capturing phase, automatically unlocks Monaco's read-only state, and applies edits directly via `editor.executeEdits()`.

### 🧠 5. Universal In-DOM Extraction Engine
- Directly scans live DOM nodes for the `PROBLEM STATEMENT` heading, input/output formats, constraints, and sample test cases.
- Completely separates and isolates the problem description from the code editor so code is never accidentally extracted.
- Runs and extracts in under **10 milliseconds** without requiring tab refreshes.

### 📌 6. Movable On-Page Floating Glass Card
- Need to keep the question in view while you write code? Click **`📌 Pin to Page`**.
- An interactive, movable glass card appears directly on your Gradstreet page. Drag it anywhere on screen or drag text from it at any time.

---

## 🏗️ Technical Architecture

```text
                           Gradstreet Assessment Page
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐                 ┌───────────────────────────────┐
│          content.js           │                 │            page.js            │
│  • In-DOM Problem Extractor   │                 │  • Runs in MAIN World         │
│  • Pinned Glass Widget Engine │                 │  • Unlocks Monaco readOnly    │
│  • ZERO Clipboard Calls       │                 │  • Standard Native Paste      │
└───────────────┬───────────────┘                 └───────────────▲───────────────┘
                │                                                 │
        [Click Extension]                                 [Ctrl+V / Cmd+V]
                │                                                 │
                ▼                                                 │
┌───────────────────────────────┐                                 │
│       popup.html / js         │                                 │
│  • Frameless Glass UI (GSAK)  │                                 │
│  • Direct DOM executeScript   │                                 │
│  • Multi-MIME DataTransfer    │                                 │
└───────────────┬───────────────┘                                 │
                │                                                 │
       [Drag & Drop Card]                                Monaco Editor API
                │                                     monaco.editor.getEditors()
                ▼                                                 │
┌───────────────────────────────┐                                 ▼
│    ChatGPT / Notepad / IDE    │                       editor.executeEdits()
└───────────────────────────────┘                                 │
                                                                  ▼
                                                        Code Inserted & Focused
```

---

## 🚀 Installation Guide

Because this extension is open-source and intended for direct personal use, it is loaded unpacked into Chrome.

### Step-by-Step for Windows, macOS & Linux

1. **Download / Clone the Repository**:
   ```bash
   git clone https://github.com/akhilgandloji789/gradstreet-copy-helper.git
   ```
   *(Or download the repository as a ZIP from GitHub and extract it).*

2. **Open Chrome Extension Settings**:
   - In Google Chrome, navigate to:
     ```text
     chrome://extensions
     ```
   - In the top-right corner, toggle on **Developer mode**.

3. **Load Unpacked Extension**:
   - Click the **Load unpacked** button in the top-left corner.
   - Select the `gradstreet-copy-helper` folder (the folder containing `manifest.json`).

4. **Pin to Toolbar**:
   - Click the puzzle icon (Extensions) in your Chrome toolbar.
   - Click the pin icon next to **Gradstreet Copy Helper** for instant 1-click access.

---

## 📖 How to Use

### 1. Extracting a Question (Drag & Drop)
1. Open any Gradstreet assessment test or practice attempt (`https://gradstreet.instacks.co/*`).
2. Click the **GSAK** icon in your Chrome toolbar.
3. The glass popup will immediately extract the question and display:
   - **`⠿ Drag Question to Any App`**: Grab this card and drop it straight into ChatGPT, Notepad, or VS Code!
   - **Glass Preview Box**: Read the extracted text or highlight any section to drag.
   - **`📋 Copy Text`**: Safe 1-click copy inside the extension popup context.
   - **`📌 Pin to Page`**: Spawns a movable on-screen glass card directly on the webpage.

### 2. Pasting Solution Code into Monaco
1. Copy your code from your IDE or external editor.
2. Click anywhere inside the Gradstreet code editor.
3. Press **`Ctrl + V`** (Windows / Linux) or **`Cmd + V`** (macOS).
4. Your code inserts cleanly into Monaco and registers with the compiler model!

---

## 🔒 Permissions & Security

| Permission | Reason for Use |
| :--- | :--- |
| `activeTab` | Allows the extension to interact with the current Gradstreet assessment tab when you click the toolbar icon. |
| `scripting` | Enables direct in-DOM extraction and on-page pinning without requiring page refreshes. |
| `https://gradstreet.instacks.co/*` | Strictly limits the extension to operate only on Gradstreet pages. |

> **Privacy Guarantee**: All processing happens 100% locally in your browser. GSAK contains zero analytics, zero external network requests, zero telemetry, and zero tracking.

---

## 🛠️ Project Structure

```text
gradstreet-copy-helper/
├── icons/
│   ├── icon16.png        # 16x16 Toolbar & Favicon
│   ├── icon48.png        # 48x48 Extension Management
│   ├── icon128.png       # 128x128 Chrome Web Store / High-DPI
│   ├── icon256.png       # 256x256 High-Resolution
│   └── logo.png          # Original Brand Artwork
├── content.js            # Universal DOM extraction & pinned glass widget
├── manifest.json         # Manifest V3 configuration & icons
├── page.js               # Monaco editor MAIN execution world bridge
├── popup.html            # Frameless dark glass UI with GSAK branding
├── popup.js              # Direct in-DOM extraction, multi-MIME drag & drop
├── logo.png              # High-res banner image for README
├── .gitignore            # Clean git configuration
└── README.md             # Documentation & usage guide
```

---

## ❓ Frequently Asked Questions

<details>
<summary><strong>Why does GSAK not ask for clipboard permissions?</strong></summary>
Because GSAK uses native HTML5 <code>DataTransfer</code> drag-and-drop instead of the clipboard. When pasting into Monaco, it intercepts native user-initiated paste events via standard DOM <code>ClipboardEvent</code>, which never prompts the browser for permission.
</details>

<details>
<summary><strong>How do I update to the latest version?</strong></summary>
Run <code>git pull</code> inside your project directory, navigate to <code>chrome://extensions</code>, and click the <strong>Reload</strong> (circular arrow) icon on the Gradstreet Copy Helper card.
</details>

<details>
<summary><strong>Can proctoring software detect GSAK?</strong></summary>
GSAK leaves zero DOM footprints on page load, does not inject any buttons by default, and never invokes monitored clipboard APIs.
</details>

---

<p align="center">
  Built with ❤️ for clean, stress-free coding assessments.
</p>
