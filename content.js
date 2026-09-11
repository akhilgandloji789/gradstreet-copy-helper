(() => {
    "use strict";

    // ==========================================
    // 1. UNIVERSAL QUESTION EXTRACTION ENGINE
    // ==========================================

    const NOISE_SELECTORS = [
        "nav",
        "header",
        "footer",
        ".monaco-editor",
        ".monaco-diff-editor",
        "[class*='timer']",
        "[class*='countdown']",
        "[class*='navbar']",
        "[class*='topbar']",
        "[class*='header-bar']",
        "button",
        "[role='button']",
        ".btn"
    ];

    const QUESTION_KEYWORDS = [
        "problem",
        "description",
        "input format",
        "output format",
        "constraints",
        "sample input",
        "sample output",
        "example",
        "explanation",
        "note:",
        "question"
    ];

    function cleanClone(element) {
        const clone = element.cloneNode(true);

        NOISE_SELECTORS.forEach(selector => {
            clone.querySelectorAll(selector).forEach(el => el.remove());
        });

        clone.querySelectorAll("[hidden], [style*='display: none'], [style*='visibility: hidden']").forEach(el => el.remove());

        return clone;
    }

    function formatNodeText(node) {
        if (!node) return "";

        let text = "";
        const children = node.childNodes;

        for (let i = 0; i < children.length; i++) {
            const child = children[i];

            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tag = child.tagName.toLowerCase();

                if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
                    text += "\n\n" + formatNodeText(child).trim() + "\n";
                } else if (tag === "p") {
                    text += "\n\n" + formatNodeText(child).trim();
                } else if (tag === "pre" || tag === "code") {
                    const codeContent = child.innerText || child.textContent;
                    text += "\n```\n" + codeContent.trim() + "\n```\n";
                } else if (tag === "li") {
                    text += "\n• " + formatNodeText(child).trim();
                } else if (tag === "br") {
                    text += "\n";
                } else if (tag === "div" || tag === "section") {
                    const inner = formatNodeText(child);
                    if (inner.trim()) {
                        text += "\n" + inner;
                    }
                } else {
                    text += formatNodeText(child);
                }
            }
        }

        return text;
    }

    function sanitizeText(raw) {
        if (!raw) return "";
        return raw
            .replace(/\r\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    function extractCodingProblem() {
        const monaco = document.querySelector(".monaco-editor, [data-keybinding-context], div[class*='monaco']");

        if (monaco) {
            let current = monaco.parentElement;
            let splitContainer = null;

            while (current && current !== document.body) {
                const style = window.getComputedStyle(current);
                const isFlexRow = style.display === "flex" && (style.flexDirection === "row" || !style.flexDirection);
                const isGrid = style.display === "grid";

                if ((isFlexRow || isGrid) && current.children.length >= 2) {
                    splitContainer = current;
                    break;
                }
                current = current.parentElement;
            }

            if (splitContainer) {
                for (let i = 0; i < splitContainer.children.length; i++) {
                    const col = splitContainer.children[i];
                    if (!col.contains(monaco)) {
                        const target = col.querySelector(".overflow-y-auto, [class*='overflow']") || col;
                        const cleaned = cleanClone(target);
                        const result = sanitizeText(formatNodeText(cleaned));
                        if (result.length > 50) {
                            return result;
                        }
                    }
                }
            }
        }

        const codingSelectors = [
            "div.flex-1.overflow-y-auto.no-scrollbar.p-6.space-y-6",
            "div.flex-1.overflow-y-auto",
            "div[class*='overflow-y-auto'][class*='p-']",
            "[data-testid*='problem']",
            "[data-testid*='question']",
            "[class*='problem-description']",
            "[class*='question-description']",
            "[class*='problem-statement']"
        ];

        for (const selector of codingSelectors) {
            const matches = document.querySelectorAll(selector);
            for (const el of matches) {
                if (el.querySelector(".monaco-editor")) continue;
                const text = el.innerText || "";
                const lower = text.toLowerCase();
                const matchCount = QUESTION_KEYWORDS.filter(k => lower.includes(k)).length;

                if (matchCount >= 2 && text.length > 60) {
                    const cleaned = cleanClone(el);
                    return sanitizeText(formatNodeText(cleaned));
                }
            }
        }

        return null;
    }

    function extractMcqQuestion() {
        const mcqSelectors = [
            "[class*='question-card']",
            "[class*='QuestionCard']",
            "[class*='question-container']",
            "[class*='assessment-question']",
            "[data-testid*='question-card']",
            ".card"
        ];

        for (const selector of mcqSelectors) {
            const card = document.querySelector(selector);
            if (!card) continue;

            const cleaned = cleanClone(card);
            const text = sanitizeText(formatNodeText(cleaned));
            if (text.length > 30) {
                return text;
            }
        }

        const optionElements = document.querySelectorAll(
            "[class*='option'], [class*='choice'], [role='radio'], input[type='radio']"
        );

        if (optionElements.length > 0) {
            const firstOption = optionElements[0];
            let ancestor = firstOption.parentElement;

            while (ancestor && ancestor !== document.body) {
                const text = ancestor.innerText || "";
                if (text.length > 80 && ancestor.querySelectorAll("input[type='radio'], [role='radio'], [class*='option']").length >= 2) {
                    const cleaned = cleanClone(ancestor);
                    const formatted = sanitizeText(formatNodeText(cleaned));
                    if (formatted.length > 40) {
                        return formatted;
                    }
                }
                ancestor = ancestor.parentElement;
            }
        }

        return null;
    }

    function extractHeuristicContent() {
        const candidates = document.querySelectorAll(
            "main, article, [role='main'], div.overflow-y-auto, div[class*='scroll']"
        );

        let bestText = null;
        let bestScore = -1;

        candidates.forEach(el => {
            if (el.querySelector(".monaco-editor")) return;
            if (el.closest("nav, header, footer")) return;

            const text = (el.innerText || "").trim();
            if (text.length < 50 || text.length > 15000) return;

            const lower = text.toLowerCase();
            let score = 0;

            QUESTION_KEYWORDS.forEach(kw => {
                if (lower.includes(kw)) score += 10;
            });

            if (text.length > 100 && text.length < 4000) score += 5;

            if (score > bestScore) {
                bestScore = score;
                const cleaned = cleanClone(el);
                bestText = sanitizeText(formatNodeText(cleaned));
            }
        });

        return bestText;
    }

    function extractQuestionText() {
        const coding = extractCodingProblem();
        if (coding && coding.length > 40) return coding;

        const mcq = extractMcqQuestion();
        if (mcq && mcq.length > 30) return mcq;

        const heuristic = extractHeuristicContent();
        if (heuristic && heuristic.length > 40) return heuristic;

        const main = document.querySelector("main") || document.body;
        if (main) {
            const cleaned = cleanClone(main);
            const fallback = sanitizeText(formatNodeText(cleaned));
            if (fallback.length > 50) return fallback;
        }

        return null;
    }

    // ==========================================
    // 2. RUNTIME MESSAGING (POPUP)
    // ==========================================
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "GET_QUESTION" || request.action === "COPY_QUESTION") {
            const questionText = extractQuestionText();

            if (questionText) {
                sendResponse({
                    success: true,
                    text: questionText,
                    length: questionText.length
                });
            } else {
                sendResponse({
                    success: false,
                    error: "Could not find question content on this page."
                });
            }
            return true;
        }

        if (request.action === "PIN_QUESTION") {
            createFloatingGlassWidget(request.text || extractQuestionText());
            sendResponse({ success: true });
            return true;
        }
    });

    // ==========================================
    // 3. ON-PAGE GLASS FLOATING CARD (ON DEMAND ONLY)
    // ==========================================
    function createFloatingGlassWidget(questionText) {
        if (!questionText) return;

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
            boxShadow: "0 20px 48px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
            color: "#f8fafc",
            zIndex: "2147483647",
            padding: "14px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            transition: "opacity 0.2s ease, transform 0.2s ease"
        });

        widget.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; cursor: move;" id="gradstreet-widget-header">
                <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: #ffffff; font-size: 13px;">
                    <span style="width: 7px; height: 7px; background: #38bdf8; border-radius: 50%; box-shadow: 0 0 8px #38bdf8;"></span>
                    Gradstreet Question
                </div>
                <button id="gradstreet-widget-close" style="background: transparent; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: all 0.15s;">✕</button>
            </div>

            <div id="gradstreet-page-drag" draggable="true" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 12px; background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%); border: 1.5px dashed rgba(56, 189, 248, 0.5); border-radius: 8px; cursor: grab; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); user-select: none;">
                <div style="color: #ffffff; font-weight: 600; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                    <span style="color: #38bdf8; font-size: 15px;">⠿</span> Drag Question to Any App
                </div>
                <div id="gradstreet-page-drag-sub" style="color: #94a3b8; font-size: 10px;">
                    Drop into ChatGPT, Notepad, VS Code...
                </div>
            </div>

            <div style="max-height: 90px; overflow-y: auto; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px; font-size: 11px; color: #cbd5e1; line-height: 1.4; white-space: pre-wrap; user-select: text;" id="gradstreet-widget-text"></div>
        `;

        document.body.appendChild(widget);

        // Populate text
        const textContainer = widget.querySelector("#gradstreet-widget-text");
        textContainer.textContent = questionText;

        // Close button
        const closeBtn = widget.querySelector("#gradstreet-widget-close");
        closeBtn.addEventListener("click", () => widget.remove());
        closeBtn.addEventListener("mouseenter", () => closeBtn.style.color = "#ffffff");
        closeBtn.addEventListener("mouseleave", () => closeBtn.style.color = "#94a3b8");

        // Draggable card
        const dragHandle = widget.querySelector("#gradstreet-page-drag");
        const dragSub = widget.querySelector("#gradstreet-page-drag-sub");

        dragHandle.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", questionText);
            e.dataTransfer.setData("Text", questionText);
            e.dataTransfer.setData("text/html", `<pre style="white-space: pre-wrap;">${questionText}</pre>`);
            e.dataTransfer.effectAllowed = "copyMove";
            dragHandle.style.opacity = "0.5";
            dragSub.textContent = "Release over your target window...";
        });

        dragHandle.addEventListener("dragend", (e) => {
            dragHandle.style.opacity = "1";
            if (e.dataTransfer.dropEffect && e.dataTransfer.dropEffect !== "none") {
                dragSub.textContent = "✅ Dropped successfully!";
                setTimeout(() => widget.remove(), 800);
            } else {
                dragSub.textContent = "Drop into ChatGPT, Notepad, VS Code...";
            }
        });

        // Make entire widget movable on screen via header
        const header = widget.querySelector("#gradstreet-widget-header");
        let isMoving = false;
        let startX = 0, startY = 0;
        let initialX = 0, initialY = 0;

        header.addEventListener("mousedown", (e) => {
            if (e.target === closeBtn) return;
            isMoving = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = widget.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;

            const onMouseMove = (moveEvent) => {
                if (!isMoving) return;
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                widget.style.left = `${initialX + dx}px`;
                widget.style.top = `${initialY + dy}px`;
                widget.style.right = "auto";
                widget.style.bottom = "auto";
            };

            const onMouseUp = () => {
                isMoving = false;
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        });
    }

})();