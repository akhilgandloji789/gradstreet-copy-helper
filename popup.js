document.addEventListener("DOMContentLoaded", () => {
    const statusContainer = document.getElementById("status-container");
    const statusText = document.getElementById("status-text");
    const spinner = document.getElementById("spinner");
    const dragBox = document.getElementById("drag-box");
    const dragSub = document.getElementById("drag-sub");
    const previewBox = document.getElementById("preview-box");
    const actionRow = document.getElementById("action-row");
    const charCount = document.getElementById("char-count");
    const copyBtn = document.getElementById("copy-btn");
    const pinBtn = document.getElementById("pin-btn");
    const selectBtn = document.getElementById("select-btn");

    let questionData = "";

    function showStatus(text, type = "normal", showSpin = false) {
        statusText.textContent = text;
        statusText.className = "status-text";
        if (type === "error") statusText.classList.add("error");
        if (type === "success") statusText.classList.add("success");
        spinner.style.display = showSpin ? "block" : "none";
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function onQuestionExtracted(text) {
        if (!text || text.trim().length < 15) {
            showStatus("Question not detected on page", "error", false);
            return;
        }

        questionData = text.trim();

        // Reveal UI elements
        statusContainer.style.display = "none";
        dragBox.style.display = "flex";
        previewBox.style.display = "block";
        previewBox.textContent = questionData;
        actionRow.style.display = "flex";

        charCount.textContent = `${questionData.length} chars ready`;
    }

    // ========================================================
    // BULLETPROOF IN-PAGE EXTRACTOR (Direct DOM access)
    // ========================================================
    function findGradstreetQuestionInDOM() {
        const monaco = document.querySelector(".monaco-editor, [data-keybinding-context], div[class*='monaco']");

        // Strategy 1: Find element containing exact "PROBLEM STATEMENT" text
        const allElements = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6, div, p, span, section"));
        const problemHeading = allElements.find(el => {
            const t = (el.innerText || "").trim().toUpperCase();
            return t === "PROBLEM STATEMENT" || t.startsWith("PROBLEM STATEMENT");
        });

        if (problemHeading) {
            let container = problemHeading.parentElement;
            while (container && container !== document.body) {
                const text = container.innerText || "";
                const lower = text.toLowerCase();
                const hasEditor = container.querySelector(".monaco-editor, [data-keybinding-context]");

                // Container must hold problem info and NOT contain the code editor
                if (!hasEditor && text.length > 80 && (lower.includes("input") || lower.includes("example") || lower.includes("output"))) {
                    // Check if parent also doesn't have the editor (to capture title)
                    const parent = container.parentElement;
                    if (parent && parent !== document.body && !parent.querySelector(".monaco-editor") && (parent.innerText || "").length < 15000) {
                        return parent.innerText.trim();
                    }
                    return text.trim();
                }
                container = container.parentElement;
            }
        }

        // Strategy 2: Left column sibling of Monaco split-pane
        if (monaco) {
            let current = monaco.parentElement;
            while (current && current !== document.body) {
                const children = Array.from(current.children);
                if (children.length >= 2) {
                    const nonEditor = children.find(c => !c.contains(monaco));
                    if (nonEditor) {
                        const txt = nonEditor.innerText || "";
                        if (txt.length > 60 && (txt.toLowerCase().includes("problem") || txt.toLowerCase().includes("example") || txt.toLowerCase().includes("input"))) {
                            return txt.trim();
                        }
                    }
                }
                current = current.parentElement;
            }
        }

        // Strategy 3: Keyword density scoring
        const keywords = ["problem statement", "input format", "output format", "example 1", "constraints"];
        let bestEl = null;
        let maxMatches = 0;

        document.querySelectorAll("div, section, article, main").forEach(el => {
            if (el.querySelector(".monaco-editor")) return;
            if (el.closest("nav, header, footer")) return;

            const text = el.innerText || "";
            if (text.length < 50 || text.length > 15000) return;

            const lower = text.toLowerCase();
            let matches = 0;
            keywords.forEach(kw => {
                if (lower.includes(kw)) matches++;
            });

            if (matches > maxMatches) {
                maxMatches = matches;
                bestEl = el;
            }
        });

        if (bestEl && maxMatches >= 1) {
            return bestEl.innerText.trim();
        }

        // Strategy 4: MCQ / Quiz Card
        const mcq = document.querySelector("[class*='question-card'], [class*='QuestionCard'], [class*='question-container'], .card");
        if (mcq && (mcq.innerText || "").length > 30) {
            return mcq.innerText.trim();
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

            // Immediately execute in page context via chrome.scripting
            // This works 100% reliably without waiting or needing tab refresh!
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: findGradstreetQuestionInDOM
            });

            if (results && results[0] && results[0].result) {
                onQuestionExtracted(results[0].result);
            } else {
                // Fallback: try asking content script
                chrome.tabs.sendMessage(tab.id, { action: "GET_QUESTION" }, (response) => {
                    if (response && response.success && response.text) {
                        onQuestionExtracted(response.text);
                    } else {
                        showStatus("Question not detected on page", "error", false);
                    }
                });
            }
        } catch (err) {
            console.error("Extraction error:", err);
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
            dragSub.textContent = "Drop into ChatGPT, Notepad, VS Code...";
        }
    });

    // Copy button (runs inside popup context - 100% safe, never prompts site)
    copyBtn.addEventListener("click", async () => {
        if (!questionData) return;
        try {
            await navigator.clipboard.writeText(questionData);
            copyBtn.innerHTML = "<span>✅</span> Copied!";
            setTimeout(() => {
                copyBtn.innerHTML = "<span>📋</span> Copy Text";
            }, 1500);
        } catch (e) {
            console.error("Clipboard copy failed:", e);
        }
    });

    // Select all text in preview
    selectBtn.addEventListener("click", () => {
        const range = document.createRange();
        range.selectNodeContents(previewBox);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        dragSub.textContent = "Text highlighted! Drag it anywhere.";
    });

    // Pin to page button
    pinBtn.addEventListener("click", async () => {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            if (!tab || !tab.id) return;

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
                        width: "330px",
                        background: "rgba(10, 12, 18, 0.90)",
                        backdropFilter: "blur(28px) saturate(200%)",
                        webkitBackdropFilter: "blur(28px) saturate(200%)",
                        border: "1px solid rgba(255, 255, 255, 0.16)",
                        borderRadius: "14px",
                        boxShadow: "0 24px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
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
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; cursor: move;" id="gw-head">
                            <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: #ffffff;">
                                <span style="width: 7px; height: 7px; background: #38bdf8; border-radius: 50%; box-shadow: 0 0 8px #38bdf8;"></span>
                                GSAK
                            </div>
                            <button id="gw-close" style="background: transparent; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 2px 6px;">✕</button>
                        </div>
                        <div id="gw-drag" draggable="true" style="padding: 14px 10px; background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%); border: 1.5px dashed rgba(56, 189, 248, 0.6); border-radius: 8px; cursor: grab; text-align: center; user-select: none;">
                            <div style="color: #fff; font-weight: 600; font-size: 13px;">⠿ Drag Question to Any App</div>
                            <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">Drop into ChatGPT, Notepad, VS Code...</div>
                        </div>
                        <div style="max-height: 100px; overflow-y: auto; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 10px; font-size: 11px; color: #cbd5e1; white-space: pre-wrap; user-select: text;" id="gw-text"></div>
                    `;

                    document.body.appendChild(widget);
                    widget.querySelector("#gw-text").textContent = text;
                    widget.querySelector("#gw-close").onclick = () => widget.remove();

                    const dragEl = widget.querySelector("#gw-drag");
                    dragEl.ondragstart = (e) => {
                        e.dataTransfer.setData("text/plain", text);
                        e.dataTransfer.setData("Text", text);
                        e.dataTransfer.setData("text/html", `<pre style="white-space: pre-wrap;">${text}</pre>`);
                        e.dataTransfer.effectAllowed = "copyMove";
                        dragEl.style.opacity = "0.5";
                    };
                    dragEl.ondragend = (e) => {
                        dragEl.style.opacity = "1";
                        if (e.dataTransfer.dropEffect && e.dataTransfer.dropEffect !== "none") {
                            setTimeout(() => widget.remove(), 800);
                        }
                    };

                    // Movable on screen
                    const head = widget.querySelector("#gw-head");
                    let isMove = false, sx = 0, sy = 0, ix = 0, iy = 0;
                    head.onmousedown = (e) => {
                        if (e.target.id === "gw-close") return;
                        isMove = true; sx = e.clientX; sy = e.clientY;
                        const r = widget.getBoundingClientRect();
                        ix = r.left; iy = r.top;
                        window.onmousemove = (me) => {
                            if (!isMove) return;
                            widget.style.left = (ix + me.clientX - sx) + "px";
                            widget.style.top = (iy + me.clientY - sy) + "px";
                            widget.style.right = "auto";
                            widget.style.bottom = "auto";
                        };
                        window.onmouseup = () => {
                            isMove = false;
                            window.onmousemove = null;
                            window.onmouseup = null;
                        };
                    };
                },
                args: [questionData]
            });

            pinBtn.innerHTML = "<span>✅</span> Pinned!";
            setTimeout(() => window.close(), 400);
        } catch (e) {
            console.error("Pin error:", e);
        }
    });

    initExtraction();
});
