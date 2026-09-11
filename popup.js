document.addEventListener("DOMContentLoaded", () => {
    const statusContainer = document.getElementById("status-container");
    const statusText = document.getElementById("status-text");
    const spinner = document.getElementById("spinner");
    const dragBox = document.getElementById("drag-box");
    const dragSub = document.getElementById("drag-sub");
    const charCount = document.getElementById("char-count");

    let questionData = "";

    function showStatus(text, type = "normal", showSpin = false) {
        statusText.textContent = text;
        statusText.className = "status-text";
        if (type === "error") statusText.classList.add("error");
        if (type === "success") statusText.classList.add("success");
        spinner.style.display = showSpin ? "block" : "none";
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
                    showStatus("Could not reach page (Try refresh)", "error", false);
                    return;
                }

                if (response.success && response.text) {
                    questionData = response.text;

                    // Hide status container and reveal draggable box
                    statusContainer.style.display = "none";
                    dragBox.style.display = "flex";

                    charCount.textContent = `${response.length} chars`;
                } else {
                    showStatus("Question not detected", "error", false);
                }
            });
        } catch (err) {
            showStatus("Scan error: " + err.message, "error", false);
        }
    }

    // ==========================================
    // HTML5 DRAG & DROP (ZERO CLIPBOARD TOUCHED)
    // ==========================================
    dragBox.addEventListener("dragstart", (event) => {
        if (!questionData) {
            event.preventDefault();
            return;
        }

        // Set plain text data for native OS drag & drop
        event.dataTransfer.setData("text/plain", questionData);
        event.dataTransfer.effectAllowed = "copyMove";

        dragBox.classList.add("dragging");
        dragSub.textContent = "Drop into ChatGPT, Notepad, VS Code...";
    });

    dragBox.addEventListener("dragend", (event) => {
        dragBox.classList.remove("dragging");

        // When user releases the drop into another window
        dragSub.textContent = "✅ Dropped successfully!";

        setTimeout(() => {
            window.close();
        }, 400);
    });

    initExtraction();
});
