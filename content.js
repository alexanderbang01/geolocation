let requests = [];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "getMetadataRequests") {
        sendResponse({ requests });
    }

    if (msg.action === "placePin") {
        const { lat, lng } = msg;
        try {
            const mapEl = document.querySelector(".guess-map_canvas, .guess-map");
            if (!mapEl || !window.map) {
                console.warn("Geoguessr map not found");
                return;
            }

            // Convert lat/lng to container pixel point
            const point = window.map.latLngToContainerPoint([lat, lng]);

            const evt = new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                clientX: point.x,
                clientY: point.y,
                view: window
            });

            mapEl.dispatchEvent(evt);
            console.log("Pin placed at", lat, lng);
        } catch (err) {
            console.error("Failed to place pin:", err);
        }
    }
});

function interceptXhr() {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
        this.addEventListener("load", function () {
            try {
                requests.push({ url: args[1], response: this.responseText });
                if (requests.length > 50) requests.shift();
            } catch (_) { }
        });
        origOpen.apply(this, args);
    };
}
interceptXhr();
