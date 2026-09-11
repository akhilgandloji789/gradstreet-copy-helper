(() => {
    "use strict";

    /**
     * Finds the target Monaco editor instance on the page.
     */
    function getTargetEditor() {
        if (
            typeof monaco !== "undefined" &&
            monaco.editor &&
            typeof monaco.editor.getEditors === "function"
        ) {
            const editors = monaco.editor.getEditors();

            if (editors && editors.length > 0) {
                // 1. Prefer the editor that currently has widget focus
                const focused = editors.find(e => {
                    try {
                        return typeof e.hasWidgetFocus === "function" && e.hasWidgetFocus();
                    } catch (_) {
                        return false;
                    }
                });
                if (focused) return focused;

                // 2. Prefer the editor whose DOM element is or contains activeElement
                const active = document.activeElement;
                if (active) {
                    const matched = editors.find(e => {
                        try {
                            const dom = typeof e.getDomNode === "function" ? e.getDomNode() : null;
                            return dom && (dom === active || dom.contains(active));
                        } catch (_) {
                            return false;
                        }
                    });
                    if (matched) return matched;
                }

                // 3. Fallback to primary editor
                return editors[0];
            }
        }

        return null;
    }

    /**
     * Inserts text directly into the Monaco editor.
     */
    function insertIntoMonaco(text) {
        if (!text) return false;

        const editor = getTargetEditor();
        if (!editor) {
            return false;
        }

        try {
            // Unlock readOnly in case the assessment locked it
            try {
                editor.updateOptions({ readOnly: false });
            } catch (_) {}

            const model = editor.getModel();
            const selection = typeof editor.getSelection === "function" ? editor.getSelection() : null;

            // If text is highlighted, replace selection; otherwise replace full model
            if (selection && !selection.isEmpty()) {
                editor.executeEdits("gradstreet-paste", [
                    {
                        range: selection,
                        text: text,
                        forceMoveMarkers: true
                    }
                ]);
            } else if (model) {
                editor.executeEdits("gradstreet-paste", [
                    {
                        range: model.getFullModelRange(),
                        text: text,
                        forceMoveMarkers: true
                    }
                ]);
            } else {
                editor.setValue(text);
            }

            editor.focus();

            window.postMessage({
                type: "GRADSTREET_PASTE_RESULT",
                success: true
            }, "*");

            return true;
        } catch (err) {
            // Fallback to setValue
            try {
                editor.setValue(text);
                editor.focus();

                window.postMessage({
                    type: "GRADSTREET_PASTE_RESULT",
                    success: true
                }, "*");

                return true;
            } catch (fallbackErr) {
                console.error("[Gradstreet Helper] Monaco insertion error:", fallbackErr);

                window.postMessage({
                    type: "GRADSTREET_PASTE_RESULT",
                    success: false,
                    error: fallbackErr.message
                }, "*");

                return false;
            }
        }
    }

    // 1. Direct in-page paste event interceptor (capturing phase)
    document.addEventListener("paste", (event) => {
        try {
            const clipboardData = event.clipboardData || window.clipboardData;
            const text = clipboardData ? clipboardData.getData("text/plain") : "";

            if (text) {
                const handled = insertIntoMonaco(text);
                if (handled) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }
        } catch (e) {
            // allow fallback
        }
    }, true);

    // 2. Window message receiver (from content.js)
    window.addEventListener("message", (event) => {
        if (event.source !== window) return;

        const message = event.data;
        if (!message || message.type !== "GRADSTREET_PASTE") return;

        insertIntoMonaco(message.text);
    });

})();