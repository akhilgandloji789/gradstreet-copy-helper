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
    });

    // ==========================================
    // 3. KEYBOARD SHORTCUTS & MONACO PASTE
    // ==========================================

    // Alt + C: Stealth instant copy from page
    document.addEventListener("keydown", async (event) => {
        if (event.altKey && event.key.toLowerCase() === "c") {
            const questionText = extractQuestionText();
            if (questionText) {
                try {
                    await navigator.clipboard.writeText(questionText);
                } catch (e) {
                    console.error("[Gradstreet Helper] Clipboard write error:", e);
                }
            }
        }
    }, true);

    // Ctrl + V / Cmd + V: Monaco Paste Backup
    document.addEventListener("keydown", async (event) => {
        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "v"
        ) {
            const active = document.activeElement;
            const isRegularInput = active && (
                active.tagName === "INPUT" ||
                (active.tagName === "TEXTAREA" && !active.classList.contains("inputarea") && !active.closest(".monaco-editor"))
            );

            // If user is inside a regular form input outside Monaco, do not intercept
            if (isRegularInput) return;

            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    window.postMessage({
                        type: "GRADSTREET_PASTE",
                        text: text
                    }, "*");
                }
            } catch (e) {
                // If readText fails, the native paste event listener in page.js will capture clipboardData
            }
        }
    }, true);

})();