document.addEventListener("DOMContentLoaded", () => {
    const statusText = document.getElementById("status-text");
    const subText = document.getElementById("sub-text");
    const spinner = document.getElementById("spinner");
    const statusIcon = document.getElementById("status-icon");
    const recopyBtn = document.getElementById("recopy-btn");

    let closeTimer = null;
    let cancelAutoClose = false;

    // Prevent auto-close if user hovers or interacts with the popup
    document.body.addEventListener("mouseenter", () => {
        cancelAutoClose = true;
        if (closeTimer) clearTimeout(closeTimer);
    });

    function setStatus(title, sub, icon = "", type = "normal", showSpinner = false) {
        statusText.textContent = title;
        subText.textContent = sub || "";

        if (showSpinner) {
            spinner.style.display = "block";
            statusIcon.style.display = "none";
        } else {
            spinner.style.display = "none";
            if (icon) {
                statusIcon.textContent = icon;
                statusIcon.style.display = "block";
            } else {
                statusIcon.style.display = "none";
            }
        }

        statusText.className = "status-text";
        if (type === "success") statusText.classList.add("success");
        if (type === "error") statusText.classList.add("error");
    }

    async function triggerCopy(autoDismiss = true) {
        setStatus("Scanning question...", "Reading assessment DOM", "📋", "normal", true);

        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];

            if (!tab || !tab.id) {
                setStatus("No active tab found", "Please retry", "❌", "error", false);
                return;
            }

            if (!tab.url || !tab.url.includes("gradstreet.instacks.co")) {
                setStatus("Not Gradstreet", "Navigate to an assessment test", "⚠️", "error", false);
                return;
            }

            chrome.tabs.sendMessage(tab.id, { action: "GET_QUESTION" }, async (response) => {
                if (chrome.runtime.lastError || !response) {
                    setStatus("Unable to reach page", "Try refreshing the test tab", "❌", "error", false);
                    return;
                }

                if (response.success && response.text) {
                    try {
                        await navigator.clipboard.writeText(response.text);
                        setStatus("✅ Question Copied!", `${response.length} characters copied`, "✅", "success", false);

                        if (autoDismiss && !cancelAutoClose) {
                            closeTimer = setTimeout(() => {
                                window.close();
                            }, 800);
                        }
                    } catch (err) {
                        setStatus("Clipboard error", "Permissions required", "❌", "error", false);
                    }
                } else {
                    setStatus("Question not detected", response.error || "No question found", "❌", "error", false);
                }
            });
        } catch (err) {
            setStatus("Detection error", err.message, "❌", "error", false);
        }
    }

    recopyBtn.addEventListener("click", () => {
        cancelAutoClose = true;
        triggerCopy(false);
    });

    // Automatically copy on popup click/open
    triggerCopy(true);
});
