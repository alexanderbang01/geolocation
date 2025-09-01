(function () {
    try {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("injected.js");
        script.async = false;
        (document.documentElement || document.head || document.body).appendChild(script);
        script.parentNode && script.parentNode.removeChild(script);
    } catch (e) {
        console.warn("Kunne ikke injicere injected.js", e);
    }

    let capturedData = [];

    window.addEventListener("message", (event) => {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || typeof msg !== "object") return;
        if (msg.source !== "geo-sniffer" || msg.type !== "GEO_META") return;

        const item = {
            url: msg.payload?.url || "",
            method: msg.payload?.method || "GET",
            response: msg.payload?.response || "",
            status: msg.payload?.status ?? 0,
            timestamp: msg.payload?.timestamp || Date.now(),
            hookType: msg.payload?.hookType || "unknown"
        };
        capturedData.push(item);
    });

    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        if (request && request.action === "getMetadataRequests") {
            sendResponse({
                requests: capturedData.slice(),
                url: window.location.href,
                timestamp: new Date().toLocaleString("da-DK")
            });
            return true;
        }
        if (request && request.action === "clearMetadataRequests") {
            capturedData = [];
            sendResponse({ success: true });
            return true;
        }
    });
})();
