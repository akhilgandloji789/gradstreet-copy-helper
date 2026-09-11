# Gradstreet Copy Helper

A lightweight, proctor-safe Chrome extension designed specifically for Gradstreet assessment tests. It enables one-click question copying across coding challenges and MCQ assessments, and allows code to be inserted directly into the Gradstreet Monaco code editor via `Ctrl+V` (or `Cmd+V`).

---

## Features

- **Stealth & Clean DOM**: Does not inject persistent buttons, banners, or visible overlays onto the assessment page. The webpage remains completely untouched until you trigger the extension.
- **One-Click Copy & Auto-Disappear**: Click the extension icon in your Chrome toolbar—it instantly detects the current question, copies it cleanly to your clipboard, displays a brief confirmation, and automatically closes within 800ms.
- **Universal Assessment Detection**: Intelligently extracts questions across various assessment formats on Gradstreet:
  - **Coding Challenges**: Extracts problem title, problem statement, input/output formats, constraints, and sample test cases (excluding the code editor).
  - **MCQ / Aptitude Questions**: Extracts the question stem, code blocks, and all available choices (A, B, C, D).
- **Direct Monaco Editor Integration (Ctrl+V / Cmd+V)**: Injects directly into the page's MAIN execution world, bypassing CSP and capturing native paste events to insert code directly into the Monaco editor via its native API.
- **Stealth Keyboard Shortcut**: Supports `Alt+C` (or `Option+C` on macOS) to instantly copy questions without touching the mouse.
- **Target Platform**: Specifically scoped to `https://gradstreet.instacks.co/*`.

---

## Technical Architecture

Modern web assessment platforms like Gradstreet render code editors using Microsoft Monaco. In these environments, the underlying `<textarea>` element is hidden and read-only, making simulated browser paste events fail. Gradstreet Copy Helper solves this through a multi-layer architecture:

```text
                Gradstreet Web Page
                        │
                        ▼
         ┌─────────────────────────────┐
         │         content.js          │ ◄──── Alt+C (Instant Copy)
         │  • Universal DOM Extractor  │
         │  • Clean Text Formatter     │
         └──────────────┬──────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
    [Click Extension]         [Ctrl+V / Cmd+V]
   ┌─────────────────┐              │
   │    popup.js     │              ▼
   │ • Extracts      │       ┌─────────────┐
   │ • Copies to     │       │   page.js   │ (Runs in MAIN world, all frames)
   │   clipboard     │       └──────┬──────┘
   │ • Auto-closes   │              │
   └─────────────────┘              ▼
                           Monaco Editor API
                     monaco.editor.getEditors()[0]
                                    │
                                    ▼
                          editor.executeEdits()
                                    │
                                    ▼
                          Code inserted & focused
```

1. **`popup.html` / `popup.js`**: When clicked from the browser toolbar, it requests the question content from the active tab. It writes the text to the clipboard from the extension's privileged context and closes itself automatically in 800ms. Has a simple "Re-Copy Question" button.
2. **`content.js`**: Runs in an isolated content script environment on Gradstreet pages. It employs a multi-tier heuristic extraction engine (identifying split-pane coding panels, MCQ cards, and scrollable content blocks while ignoring navigation bars, timers, and action buttons).
3. **`page.js`**: Runs natively in the page's `MAIN` execution world across all frames. It intercepts native `paste` and window message events, unlocks read-only editor states, and applies `executeEdits` / `setValue` directly to the Monaco editor.

---

## Installation Guide

Because this extension is open-source and intended for direct personal use, it is loaded unpacked through Chrome's Developer Mode.

### Windows & Linux

1. Download this repository as a ZIP file (or clone via Git).
2. Extract the ZIP to a local folder (e.g., `gradstreet-copy-helper`).
3. Open **Google Chrome**.
4. Navigate to:
   ```text
   chrome://extensions
   ```
5. Toggle on **Developer mode** in the top right corner.
6. Click **Load unpacked** in the top left.
7. Select the folder containing `manifest.json`.
8. Pin **Gradstreet Copy Helper** to your Chrome toolbar for easy access.

### macOS

1. Download and extract the repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the folder.
5. Use `Cmd+V` to paste code into the Monaco editor.

---

## How to Use

1. Navigate to any Gradstreet assessment or practice attempt (`https://gradstreet.instacks.co/*`).
2. **To Copy the Question**:
   - Click the **Gradstreet Copy Helper** icon in the top-right Chrome toolbar.
   - The popup will show `✅ Question Copied!` and disappear automatically in under a second.
   - *Alternative*: Press `Alt+C` (or `Option+C` on Mac) directly on the test page.
3. **To Paste Code into the Editor**:
   - Copy your code from your external IDE or source.
   - Click inside the Gradstreet Monaco editor and press `Ctrl+V` (or `Cmd+V` on Mac).
   - The code will be inserted cleanly into the editor.

---

## Permissions Explained

- **`clipboardRead`**: Required to read code from your clipboard when you press `Ctrl+V` / `Cmd+V` to insert into the Monaco editor.
- **`clipboardWrite`**: Required to write extracted question text and test cases to your clipboard.
- **`activeTab`**: Enables the extension popup to communicate with the currently active assessment tab when clicked.
- **`host_permissions` (`https://gradstreet.instacks.co/*`)**: Ensures the extension only operates on Gradstreet assessment pages and cannot access any other website.

---

## Troubleshooting

- **Updating the extension**: After any update, go to `chrome://extensions` and click the **Reload** (circular arrow) icon on the Gradstreet Copy Helper card, then refresh the Gradstreet tab.
- **Code not inserting on Ctrl+V**: Click inside the Monaco editor box once to focus it, then press `Ctrl+V` (or `Cmd+V`). Ensure you have reloaded the Gradstreet page after updating the extension in Chrome.
