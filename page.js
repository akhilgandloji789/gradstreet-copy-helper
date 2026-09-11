(() => {
    "use strict";

    function getEditor() {
        if (
            typeof monaco !== "undefined" &&
            monaco.editor &&
            typeof monaco.editor.getEditors === "function"
        ) {
            const editors = monaco.editor.getEditors();

            if (editors && editors.length > 0) {
                // If any editor has focus, prefer that
                const focused = editors.find(e => {
                    try {
                        return typeof e.hasWidgetFocus === "function" && e.hasWidgetFocus();
                    } catch (err) {
                        return false;
                    }
                });

                if (focused) return focused;

                // Otherwise pick the largest/primary editor
                return editors[0];
            }
        }

        return null;
    }

    window.addEventListener("message", (event) => {
        if (event.source !== window) return;

        const message = event.data;
        if (!message || message.type !== "GRADSTREET_PASTE") return;

        const editor = getEditor();

        if (!editor) {
            window.postMessage({
                type: "GRADSTREET_PASTE_RESULT",
                success: false,
                error: "Monaco editor not found"
            }, "*");
            return;
        }

        try {
            // Replace the editor contents
            editor.setValue(message.text);

            // Focus and format cursor position
            editor.focus();

            window.postMessage({
                type: "GRADSTREET_PASTE_RESULT",
                success: true
            }, "*");
        } catch (error) {
            window.postMessage({
                type: "GRADSTREET_PASTE_RESULT",
                success: false,
                error: error.message
            }, "*");
        }
    });

})();