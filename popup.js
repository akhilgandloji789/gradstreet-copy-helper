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

            chrome.tabs.sendMessage(tab.id, { action: "GET_QUESTION" }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    showStatus("Could not reach page (Try refreshing test)", "error", false);
                    return;
                }

                if (response.success && response.text) {
                    questionData = response.text;

                    // Reveal components
                    statusContainer.style.display = "none";
                    dragBox.style.display = "flex";
                    previewBox.style.display = "block";
                    previewBox.textContent = questionData;
                    actionRow.style.display = "flex";

                    charCount.textContent = `${response.length} chars ready`;
                } else {
                    showStatus("Question not detected", "error", false);
                }
            });
        } catch (err) {
            showStatus("Scan error: " + err.message, "error", false);
        }
    }

    // ==========================================
    // HTML5 DRAG & DROP WITH MULTI-MIME SUPPORT
    // ==========================================
    dragBox.addEventListener("dragstart", (event) => {
        if (!questionData) {
            event.preventDefault();
            return;
        }

        // Set plain text and HTML representations
        event.dataTransfer.setData("text/plain", questionData);
        event.dataTransfer.setData("Text", questionData);
        event.dataTransfer.setData("text/html", `<pre style="white-space: pre-wrap; font-family: monospace;">${escapeHtml(questionData)}</pre>`);
        event.dataTransfer.effectAllowed = "copyMove";

        dragBox.classList.add("dragging");
        dragSub.textContent = "Release over ChatGPT / Notepad...";
    });

    dragBox.addEventListener("dragend", (event) => {
        dragBox.classList.remove("dragging");

        // If drop occurred
        if (event.dataTransfer.dropEffect && event.dataTransfer.dropEffect !== "none") {
            dragSub.textContent = "✅ Dropped successfully!";
            setTimeout(() => {
                window.close();
            }, 600);
        } else {
            dragSub.textContent = "Grab & drop into ChatGPT, Notepad, VS Code...";
        }
    });

    // Select text button
    selectBtn.addEventListener("click", () => {
        const range = document.createRange();
        range.selectNodeContents(previewBox);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        dragSub.textContent = "Text selected! You can drag selection.";
    });

    // Pin to page button (creates on-page glassy widget)
    pinBtn.addEventListener("click", async () => {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "PIN_QUESTION",
                    text: questionData
                });
                pinBtn.textContent = "✅ Pinned to Page!";
                setTimeout(() => window.close(), 500);
            }
        } catch (e) {
            console.error("Pin failed:", e);
        }
    });

    initExtraction();
});
