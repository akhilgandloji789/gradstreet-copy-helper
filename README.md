# Gradstreet Copy Helper

A lightweight, proctor-safe Chrome extension designed specifically for Gradstreet assessment tests. It enables **zero-clipboard drag-and-drop question extraction** across coding challenges and MCQ assessments, and allows solution code to be inserted directly into the Gradstreet Monaco code editor via `Ctrl+V` (or `Cmd+V`).

---

## Features

- **Zero Clipboard Footprint (100% Proctor-Safe)**: Does **not** request or use any clipboard read/write permissions (`clipboardRead` and `clipboardWrite` are completely removed). The browser will **never** display the prompt *"gradstreet.instacks.co wants to: See text and images copied to the clipboard"*.
- **No Clipboard Overwrite**: If you already have your solution code on your clipboard, extracting a question will **never** overwrite or erase your copied code.
- **Draggable Question Box**:
  - Click the extension icon in your Chrome toolbar.
  - A clean draggable box appears: `⠿ Drag Question to Any App`.
  - Click and drag directly into **ChatGPT, Notepad, VS Code, or another browser tab**.
  - Drop to insert. The popup automatically closes once the drop completes.
- **Universal Assessment Detection**: Intelligently extracts questions across various assessment formats on Gradstreet:
  - **Coding Challenges**: Problem statement, description, input/output formats, constraints, and sample test cases (excluding the code editor).
  - **MCQ / Aptitude Questions**: Question stem, code blocks, and all available choices (A, B, C, D).
- **Direct Monaco Editor Integration (Ctrl+V / Cmd+V)**: Runs in the page's MAIN execution world, bypassing CSP and unlocking Monaco's read-only restrictions via native paste event capture without triggering clipboard permission prompts.
- **Target Platform**: Specifically scoped to `https://gradstreet.instacks.co/*`.

---

## Technical Architecture

```text
                Gradstreet Web Page
                        │
                        ▼
         ┌─────────────────────────────┐
         │         content.js          │
         │  • Universal DOM Extractor  │
         │  • Pure Read-Only Parsing   │
         │  • ZERO Clipboard Calls     │
         └──────────────┬──────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
    [Click Extension]         [Ctrl+V / Cmd+V]
   ┌─────────────────┐              │
   │    popup.js     │              ▼
   │  • Drag & Drop  │       ┌─────────────┐
   │    DataTransfer │       │   page.js   │ (Runs in MAIN world, all frames)
   │  • ZERO         │       │  • Standard │
   │    Clipboard    │       │    paste    │ (event.clipboardData - NO prompt)
   │    Access       │       └──────┬──────┘
   └────────┬────────┘              │
            │                       ▼
            ▼               Monaco Editor API
    [Drag & Drop into       editor.executeEdits()
     ChatGPT / Notes]               │
                                    ▼
                          Code inserted & focused
```

1. **`popup.html` / `popup.js`**: When opened, queries the active tab for the question text. Uses HTML5 `DataTransfer` (`event.dataTransfer.setData("text/plain", question)`). When dragged into any desktop window or browser input, the OS transfers the text via native drag-and-drop. The clipboard is completely untouched.
2. **`content.js`**: Runs in an isolated content script environment on Gradstreet pages. Reads the question using heuristic DOM extraction. Contains zero clipboard read or write operations.
3. **`page.js`**: Injected natively into the page's `MAIN` execution world at `document_start` across all frames. Intercepts native paste events via `event.clipboardData.getData("text/plain")`, which never triggers browser permission prompts, unlocks Monaco, and executes edits.

---

## Installation Guide

Because this extension is open-source and intended for direct personal use, it is loaded unpacked through Chrome's Developer Mode.

### Windows & Linux

1. Download or clone this repository to a local folder (e.g., `gradstreet-copy-helper`).
2. Open **Google Chrome**.
3. Navigate to:
   ```text
   chrome://extensions
   ```
4. Toggle on **Developer mode** in the top right corner.
5. Click **Load unpacked** in the top left.
6. Select the folder containing `manifest.json`.
7. Pin **Gradstreet Copy Helper** to your Chrome toolbar.

### macOS

1. Follow the same steps as above.
2. Use `Cmd+V` to paste code into the Monaco editor.

---

## How to Use

1. Navigate to any Gradstreet assessment or practice attempt (`https://gradstreet.instacks.co/*`).
2. **To Extract the Question (Drag & Drop)**:
   - Click the **Gradstreet Copy Helper** icon in the top-right Chrome toolbar.
   - The popup displays:
     ```text
     ┌────────────────────────────────────────┐
     │  ⠿ Drag Question to Any App            │
     │    Drop into ChatGPT, Notepad, VS Code │
     └────────────────────────────────────────┘
     ```
   - Click and drag that card directly into your target app (ChatGPT input box, Notepad, VS Code, etc.).
   - Release the mouse button to drop. The question inserts cleanly, and the popup automatically closes.
   - **Notice**: Zero clipboard access—no prompt will ever appear!
3. **To Paste Code into the Editor**:
   - Copy your code from your external IDE or source.
   - Click inside the Gradstreet Monaco editor and press `Ctrl+V` (or `Cmd+V` on Mac).
   - The code will be inserted cleanly into the editor.

---

## Permissions Explained

- **`activeTab`**: Enables the extension popup to communicate with the currently active assessment tab when clicked.
- **`host_permissions` (`https://gradstreet.instacks.co/*`)**: Ensures the extension only operates on Gradstreet assessment pages and cannot access any other website.
- **Notice**: `clipboardRead` and `clipboardWrite` are **completely removed** to eliminate browser permission dialogs entirely.

---

## Troubleshooting

- **Updating the extension**: After pulling updates, go to `chrome://extensions` and click the **Reload** (circular arrow) icon on the Gradstreet Copy Helper card, then refresh the Gradstreet tab.
- **Code not inserting on Ctrl+V**: Click inside the Monaco editor box once to focus it, then press `Ctrl+V` (or `Cmd+V`). Ensure you have reloaded the Gradstreet page after updating the extension in Chrome.
