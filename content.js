(() => {
    "use strict";

    // ==========================================
    // 1. INJECT PAGE SCRIPT (MONACO BRIDGE)
    // ==========================================
    try {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("page.js");
        script.onload = () => script.remove();
        (document.head || document.documentElement).appendChild(script);
    } catch (e) {
        console.warn("[Gradstreet Helper] Monaco bridge injection warning:", e);
    }

    // ==========================================
    // 2. UNIVERSAL QUESTION EXTRACTION ENGINE
    // ==========================================

    /**
     * Noise selectors that should be excluded from extracted text
     */
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

    /**
     * Keywords that strongly indicate question or problem description content
     */
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

    /**
     * Cleans an element clone by removing buttons, timers, editors, and UI noise.
     */
    function cleanClone(element) {
        const clone = element.cloneNode(true);

        // Remove noise selectors
        NOISE_SELECTORS.forEach(selector => {
            clone.querySelectorAll(selector).forEach(el => el.remove());
        });

        // Remove hidden elements
        clone.querySelectorAll("[hidden], [style*='display: none'], [style*='visibility: hidden']").forEach(el => el.remove());

        return clone;
    }

    /**
     * Converts a DOM node into cleanly formatted text, preserving paragraphs,
     * code blocks, lists, and options.
     */
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

    /**
     * Normalize formatted text (remove excessive newlines and trim).
     */
    function sanitizeText(raw) {
        if (!raw) return "";
        return raw
            .replace(/\r\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    /**
     * Strategy 1: Detect Split-Pane Coding Assessment Layout.
     * Looks for Monaco editor and extracts the problem description pane to its left.
     */
    function extractCodingProblem() {
        const monaco = document.querySelector(".monaco-editor, [data-keybinding-context], div[class*='monaco']");

        if (monaco) {
            // Traverse up to find split container
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
                // Find sibling column that does not contain Monaco
                for (let i = 0; i < splitContainer.children.length; i++) {
                    const col = splitContainer.children[i];
                    if (!col.contains(monaco)) {
                        // This is the problem description panel
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

        // Direct container matches for Gradstreet coding panels
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

    /**
     * Strategy 2: Detect MCQ / Quiz Assessment Layout.
     * Extracts question prompt + all options (A, B, C, D).
     */
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

        // Search for question stems and options
        const optionElements = document.querySelectorAll(
            "[class*='option'], [class*='choice'], [role='radio'], input[type='radio']"
        );

        if (optionElements.length > 0) {
            // Find parent common ancestor holding the question and options
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

    /**
     * Strategy 3: Heuristic Scorer for Any Assessment View.
     * Evaluates scrollable containers and picks the highest scoring content block.
     */
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

            // Length score bonus
            if (text.length > 100 && text.length < 4000) score += 5;

            if (score > bestScore) {
                bestScore = score;
                const cleaned = cleanClone(el);
                bestText = sanitizeText(formatNodeText(cleaned));
            }
        });

        return bestText;
    }

    /**
     * Master extraction function combining all strategies.
     */
    function extractQuestionText() {
        // Try coding assessment
        const coding = extractCodingProblem();
        if (coding && coding.length > 40) return coding;

        // Try MCQ / quiz assessment
        const mcq = extractMcqQuestion();
        if (mcq && mcq.length > 30) return mcq;

        // Try heuristic fallback
        const heuristic = extractHeuristicContent();
        if (heuristic && heuristic.length > 40) return heuristic;

        // Ultimate fallback: look for largest visible text section excluding editor
        const main = document.querySelector("main") || document.body;
        if (main) {
            const cleaned = cleanClone(main);
            const fallback = sanitizeText(formatNodeText(cleaned));
            if (fallback.length > 50) return fallback;
        }

        return null;
    }

    // ==========================================
    // 3. TRANSIENT STEALTH NOTIFICATION (OPTIONAL)
    // ==========================================
    function showTransientNotification(message, isError = false) {
        const existing = document.getElementById("gradstreet-helper-toast");
        if (existing) existing.remove();

        const toast = document.createElement("div");
        toast.id = "gradstreet-helper-toast";
        toast.textContent = message;

        Object.assign(toast.style, {
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: "2147483647",
            padding: "8px 14px",
            borderRadius: "6px",
            background: isError ? "#ef4444" : "#10b981",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: "500",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            pointerEvents: "none",
            opacity: "0",
            transition: "opacity 0.2s ease, transform 0.2s ease",
            transform: "translateY(8px)",
            fontFamily: "system-ui, -apple-system, sans-serif"
        });

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = "1";
            toast.style.transform = "translateY(0)";
        });

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(8px)";
            setTimeout(() => toast.remove(), 250);
        }, 1200);
    }

    // ==========================================
    // 4. CHROME RUNTIME MESSAGING (POPUP / SHORTCUT)
    // ==========================================
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "GET_QUESTION" || request.action === "COPY_QUESTION") {
            const questionText = extractQuestionText();

            if (questionText) {
                // If requested directly from content script, copy to clipboard
                navigator.clipboard.writeText(questionText).catch(() => {
                    // Fallback handled by caller if needed
                });

                sendResponse({
                    success: true,
                    text: questionText,
                    length: questionText.length,
                    preview: questionText.slice(0, 120).trim() + "..."
                });
            } else {
                sendResponse({
                    success: false,
                    error: "Could not find question content on this page."
                });
            }
            return true;
        }

        if (request.action === "PASTE_CODE") {
            window.postMessage({
                type: "GRADSTREET_PASTE",
                text: request.code || ""
            }, "*");

            sendResponse({ success: true });
            return true;
        }
    });

    // ==========================================
    // 5. IN-PAGE KEYBOARD SHORTCUTS
    // ==========================================

    // Alt + C (or Option + C): Stealth instant copy
    document.addEventListener("keydown", async (event) => {
        if (event.altKey && event.key.toLowerCase() === "c") {
            event.preventDefault();
            event.stopImmediatePropagation();

            const questionText = extractQuestionText();
            if (questionText) {
                try {
                    await navigator.clipboard.writeText(questionText);
                    showTransientNotification("Question Copied!");
                } catch (e) {
                    console.error("[Gradstreet Helper] Clipboard write error:", e);
                }
            } else {
                showTransientNotification("Question not detected", true);
            }
        }
    }, true);

    // Ctrl + V / Cmd + V: Insert code into Monaco editor
    document.addEventListener("keydown", async (event) => {
        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "v"
        ) {
            // If user is focused inside a standard text input/textarea that is not Monaco, let default paste happen
            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
            const isInsideMonaco = document.activeElement && (
                document.activeElement.closest(".monaco-editor") ||
                document.activeElement.classList.contains("inputarea")
            );

            if (!isInsideMonaco && (activeTag === "input" || activeTag === "textarea")) {
                return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();

            try {
                const text = await navigator.clipboard.readText();
                if (!text) return;

                window.postMessage({
                    type: "GRADSTREET_PASTE",
                    text: text
                }, "*");
            } catch (error) {
                console.error("[Gradstreet Helper] Clipboard read failed:", error);
            }
        }
    }, true);

    // ==========================================
    // 6. RESULT FROM MONACO EDITOR
    // ==========================================
    window.addEventListener("message", (event) => {
        if (event.source !== window) return;

        if (event.data && event.data.type === "GRADSTREET_PASTE_RESULT") {
            if (event.data.success) {
                showTransientNotification("Code inserted into editor");
            } else {
                console.warn("[Gradstreet Helper] Monaco insertion:", event.data.error);
            }
        }
    });

})();