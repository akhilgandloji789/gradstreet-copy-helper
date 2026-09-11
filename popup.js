document.addEventListener("DOMContentLoaded", () => {
    const statusContainer = document.getElementById("status-container");
    const statusText = document.getElementById("status-text");
    const spinner = document.getElementById("spinner");
    const dragBox = document.getElementById("drag-box");
    const dragSub = document.getElementById("drag-sub");
    const previewBox = document.getElementById("preview-box");
    const actionRow = document.getElementById("action-row");
    const charCount = document.getElementById("char-count");
    const pinBtn = document.getElementById("pin-btn");
    const selectBtn = document.getElementById("select-btn");

    let questionData = "";

    function showStatus(text, type = "normal", showSpin = false) {
        statusText.textContent = text;
        statusText.className = "status-text";
        if (type === "error") statusText.classList.add("error");
        spinner.style.display = showSpin ? "block" : "none";
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function onQuestionExtracted(text) {
        if (!text || text.length < 10) {
            showStatus("Question not detected on page", "error", false);
            return;
        }

        questionData = text;

        // Reveal UI elements
        statusContainer.style.display = "none";
        dragBox.style.display = "flex";
        previewBox.style.display = "block";
        previewBox.textContent = questionData;
        actionRow.style.display = "flex";

        charCount.textContent = `${questionData.length} chars ready`;
    }

    // Self-contained in-page extractor for direct execution
    function extractQuestionFromPage() {
        const NOISE_SELECTORS = [
            "nav", "header", "footer", ".monaco-editor", ".monaco-diff-editor",
            "[class*='timer']", "[class*='countdown']", "[class*='navbar']",
            "[class*='topbar']", "button", "[role='button']", ".btn",
            "#gradstreet-glass-widget"
        ];

        const QUESTION_KEYWORDS = [
            "problem statement", "problem", "description", "input format",
            "output format", "constraints", "sample input", "sample output",
            "example", "explanation", "note:", "question"
        ];

        function cleanClone(el) {
            const clone = el.cloneNode(true);
            NOISE_SELECTORS.forEach(s => clone.querySelectorAll(s).forEach(e => e.remove()));
            clone.querySelectorAll("[hidden], [style*='display: none'], [style*='visibility: hidden']").forEach(e => e.remove());
            return clone;
        }

        function formatText(node) {
            if (!node) return "";
            let text = "";
            node.childNodes.forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    text += child.textContent;
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    const tag = child.tagName.toLowerCase();
                    if (["h1","h2","h3","h4","h5","h6"].includes(tag)) {
                        text += "\n\n" + formatText(child).trim() + "\n";
                    } else if (tag === "p") {
                        text += "\n\n" + formatText(child).trim();
                    } else if (tag === "pre" || tag === "code") {
                        text += "\n```\n" + (child.innerText || child.textContent).trim() + "\n```\n";
                    } else if (tag === "li") {
                        text += "\n• " + formatText(child).trim();
                    } else if (tag === "br") {
                        text += "\n";
                    } else if (tag === "div" || tag === "section") {
                        const inner = formatText(child);
                        if (inner.trim()) text += "\n" + inner;
                    } else {
                        text += formatText(child);
                    }
                }
            });
            return text;
        }

        function sanitize(raw) {
            if (!raw) return "";
            return raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        }

        // 1. Check for Monaco split-pane left container
        const monaco = document.querySelector(".monaco-editor, [data-keybinding-context], div[class*='monaco']");
        if (monaco) {
            let current = monaco.parentElement;
            while (current && current !== document.body) {
                const style = window.getComputedStyle(current);
                const isFlexRow = style.display === "flex" && (style.flexDirection === "row" || !style.flexDirection);
                const isGrid = style.display === "grid";

                if ((isFlexRow || isGrid) && current.children.length >= 2) {
                    for (let i = 0; i < current.children.length; i++) {
                        const col = current.children[i];
                        if (!col.contains(monaco)) {
                            const target = col.querySelector(".overflow-y-auto, [class*='overflow']") || col;
                            const cleaned = cleanClone(target);
                            const result = sanitize(formatText(cleaned));
                            if (result.length > 40) return result;
                        }
                    }
                }
                current = current.parentElement;
            }
        }

        // 2. Direct problem container search
        const candidates = document.querySelectorAll(
            "div.flex-1.overflow-y-auto, div.overflow-y-auto, div[class*='overflow'], main, article, [data-testid*='problem'], [class*='problem']"
        );

        let bestText = null;
        let bestScore = -1;

        candidates.forEach(el => {
            if (el.querySelector(".monaco-editor")) return;
            if (el.closest("nav, header, footer")) return;

            const raw = (el.innerText || "").trim();
            if (raw.length < 50 || raw.length > 20000) return;

            const lower = raw.toLowerCase();
            let score = 0;
            QUESTION_KEYWORDS.forEach(kw => {
                if (lower.includes(kw)) score += 10;
            });

            if (score > bestScore) {
                bestScore = score;
                const cleaned = cleanClone(el);
                bestText = sanitize(formatText(cleaned));
            }
        });

        if (bestText && bestText.length > 40) return bestText;

        // 3. Fallback to main or body
        const main = document.querySelector("main") || document.body;
        if (main) {
            const cleaned = cleanClone(main);
            return sanitize(formatText(cleaned));
        }

        return null;
    }

    async function initExtraction() {
        showStatus("Scanning question...", "normal", true);

        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];

            if (!tab || !tab.id) {
                showStatus("No active tab found", "error", false);
                return;
            }

            if (!tab.url || !tab.url.includes("gradstreet.instacks.co")) {
                showStatus("Open a Gradstreet test tab", "error", false);
                return;
            }

            // Attempt 1: Try messaging content script
            chrome.tabs.sendMessage(tab.id, { action: "GET_QUESTION" }, async (response) => {
                if (!chrome.runtime.lastError && response && response.success && response.text) {
                    onQuestionExtracted(response.text);
                    return;
                }

                // Attempt 2: Content script wasn't ready in tab!
                // Directly execute extraction via chrome.scripting without requiring tab refresh!
                try {
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: extractQuestionFromPage
                    });

                    if (results && results[0] && results[0].result) {
                        onQuestionExtracted(results[0].result);
                    } else {
                        showStatus("Question not detected on page", "error", false);
                    }
                } catch (scriptErr) {
                    console.error("Direct execution failed:", scriptErr);
                    showStatus("Please refresh the test page once", "error", false);
                }
            });
        } catch (err) {
            showStatus("Scan error: " + err.message, "error", false);
        }
    }

    // ==========================================
    // MULTI-MIME DRAG & DROP
    // ==========================================
    dragBox.addEventListener("dragstart", (event) => {
        if (!questionData) {
            event.preventDefault();
            return;
        }

        event.dataTransfer.setData("text/plain", questionData);
        event.dataTransfer.setData("Text", questionData);
        event.dataTransfer.setData("text/html", `<pre style="white-space: pre-wrap; font-family: monospace;">${escapeHtml(questionData)}</pre>`);
        event.dataTransfer.effectAllowed = "copyMove";

        dragBox.classList.add("dragging");
        dragSub.textContent = "Release over ChatGPT, Notepad, VS Code...";
    });

    dragBox.addEventListener("dragend", (event) => {
        dragBox.classList.remove("dragging");

        if (event.dataTransfer.dropEffect && event.dataTransfer.dropEffect !== "none") {
            dragSub.textContent = "✅ Dropped successfully!";
            setTimeout(() => {
                window.close();
            }, 600);
        } else {
            dragSub.textContent = "Grab & drop into ChatGPT, Notepad, VS Code...";
        }
    });

    // Select all text in preview box
    selectBtn.addEventListener("click", () => {
        const range = document.createRange();
        range.selectNodeContents(previewBox);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        dragSub.textContent = "Text selected! Drag highlighted text anywhere.";
    });

    // Pin to page button
    pinBtn.addEventListener("click", async () => {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            if (!tab || !tab.id) return;

            // Try sending message first
            chrome.tabs.sendMessage(tab.id, { action: "PIN_QUESTION", text: questionData }, async (resp) => {
                if (chrome.runtime.lastError || !resp) {
                    // Inject and pin directly
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: (text) => {
                            const existing = document.getElementById("gradstreet-glass-widget");
                            if (existing) existing.remove();

                            const widget = document.createElement("div");
                            widget.id = "gradstreet-glass-widget";
                            Object.assign(widget.style, {
                                position: "fixed",
                                bottom: "24px",
                                right: "24px",
                                width: "320px",
                                background: "rgba(10, 12, 18, 0.88)",
                                backdropFilter: "blur(24px) saturate(190%)",
                                webkitBackdropFilter: "blur(24px) saturate(190%)",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                borderRadius: "12px",
                                boxShadow: "0 20px 48px rgba(0, 0, 0, 0.7)",
                                color: "#f8fafc",
                                zIndex: "2147483647",
                                padding: "14px",
                                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                fontSize: "12px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px"
                            });

                            widget.innerHTML = `
                                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                                    <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: #ffffff;">
                                        <span style="width: 7px; height: 7px; background: #38bdf8; border-radius: 50%;"></span>
                                        Gradstreet Question
                                    </div>
                                    <button id="gw-close" style="background: transparent; border: none; color: #94a3b8; font-size: 14px; cursor: pointer;">✕</button>
                                </div>
                                <div id="gw-drag" draggable="true" style="padding: 12px; background: rgba(255,255,255,0.05); border: 1.5px dashed #38bdf8; border-radius: 8px; cursor: grab; text-align: center;">
                                    <div style="color: #fff; font-weight: 600;">⠿ Drag Question to Any App</div>
                                    <div style="color: #94a3b8; font-size: 10px;">Drop into ChatGPT, Notepad, VS Code...</div>
                                </div>
                                <div style="max-height: 90px; overflow-y: auto; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px; font-size: 11px; color: #cbd5e1; white-space: pre-wrap;" id="gw-text"></div>
                            `;

                            document.body.appendChild(widget);
                            widget.querySelector("#gw-text").textContent = text;
                            widget.querySelector("#gw-close").onclick = () => widget.remove();

                            const dragEl = widget.querySelector("#gw-drag");
                            dragEl.ondragstart = (e) => {
                                e.dataTransfer.setData("text/plain", text);
                                e.dataTransfer.setData("Text", text);
                                e.dataTransfer.effectAllowed = "copyMove";
                            };
                            dragEl.ondragend = (e) => {
                                if (e.dataTransfer.dropEffect && e.dataTransfer.dropEffect !== "none") {
                                    setTimeout(() => widget.remove(), 800);
                                }
                            };
                        },
                        args: [questionData]
                    });
                }
                pinBtn.textContent = "✅ Pinned!";
                setTimeout(() => window.close(), 500);
            });
        } catch (e) {
            console.error("Pin error:", e);
        }
    });

    initExtraction();
});
