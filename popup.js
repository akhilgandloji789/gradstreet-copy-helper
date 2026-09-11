document.addEventListener("DOMContentLoaded", () => {
    const statusBox = document.getElementById("status-box");
    const statusText = document.getElementById("status-text");
    const subText = document.getElementById("sub-text");
    const spinner = document.getElementById("spinner");
    const copyBtn = document.getElementById("copy-btn");
    const pasteBtn = document.getElementById("paste-btn");

    let closeTimer = null;
    let cancelAutoClose = false;

    // Prevent auto-close if user hovers or interacts with the popup
    document.body.addEventListener("mouseenter", () => {
        cancelAutoClose = true;
        if (closeTimer) clearTimeout(closeTimer);
    });

    function setStatus(title, sub, type = "normal", showSpinner = false) {
        statusText.textContent = title;
        subText.textContent = sub || "";
        spinner.style.display = showSpinner ? "block" : "none";

        statusText.className = "status-text";
        if (type === "success") statusText.classList.add("success");
        if (type === "error") statusText.classList.add("error");
    }

    async function triggerCopy(autoDismiss = true) {
        setStatus("Extracting question...", "Scanning DOM structure", "normal", true);

        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];

            if (!tab || !tab.id) {
                setStatus("No active tab found", "Please retry", "error", false);
                return;
            }

            if (!tab.url || !tab.url.includes("gradstreet.instacks.co")) {
                setStatus("Not Gradstreet", "Navigate to an assessment test", "error", false);
                return;
            }

            chrome.tabs.sendMessage(tab.id, { action: "GET_QUESTION" }, async (response) => {
                if (chrome.runtime.lastError || !response) {
                    setStatus("Unable to reach page", "Try refreshing the test tab", "error", false);
                    return;
                }

                if (response.success && response.text) {
                    try {
                        await navigator.clipboard.writeText(response.text);
                        setStatus("✅ Question Copied!", `${response.length} characters copied`, "success", false);

                        if (autoDismiss && !cancelAutoClose) {
                            closeTimer = setTimeout(() => {
                                window.close();
                            }, 800);
                        }
                    } catch (err) {
                        setStatus("Clipboard error", "Permissions required", "error", false);
                    }
                } else {
                    setStatus("Question not found", response.error || "No question detected", "error", false);
                }
            });
        } catch (err) {
            setStatus("Detection error", err.message, "error", false);
        }
    }

    async function triggerPaste() {
        cancelAutoClose = true;
        if (closeTimer) clearTimeout(closeTimer);

        setStatus("Reading clipboard...", "Preparing to insert", "normal", true);

        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];

            if (!tab || !tab.id) {
                setStatus("No active tab found", "", "error", false);
                return;
            }

            const clipboardText = await navigator.clipboard.readText();
            if (!clipboardText) {
                setStatus("Clipboard empty", "Copy your code first", "error", false);
                return;
            }

            chrome.tabs.sendMessage(tab.id, { action: "PASTE_CODE", code: clipboardText }, (response) => {
                if (chrome.runtime.lastError) {
                    setStatus("Paste failed", "Could not reach editor", "error", false);
                } else {
                    setStatus("✅ Inserted into Editor!", "Code sent to Monaco", "success", false);
                    setTimeout(() => window.close(), 1000);
                }
            });
        } catch (err) {
            setStatus("Paste error", err.message, "error", false);
        }
    }

    copyBtn.addEventListener("click", () => {
        cancelAutoClose = true;
        triggerCopy(false);
    });

    pasteBtn.addEventListener("click", () => {
        triggerPaste();
    });

    // Auto-execute copy on popup open
    triggerCopy(true);
});
