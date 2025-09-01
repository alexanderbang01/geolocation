let attachedTabId = null;
const requestUrlById = new Map();

function base64ToUtf8(b64) {
    try {
        const bin = atob(b64);
        const bytes = new Uint8Array([...bin].map(ch => ch.charCodeAt(0)));
        return new TextDecoder("utf-8").decode(bytes);
    } catch (e) {
        return atob(b64);
    }
}

function stripJSONP(text) {
    const first = text.indexOf("(");
    const last = text.lastIndexOf(")");
    if (first !== -1 && last !== -1 && last > first) {
        return text.slice(first + 1, last);
    }
    return text;
}

function findPlaceCandidate(node, prefs = ["en", "da", "es"]) {
    let best = null;
    function scan(n) {
        if (Array.isArray(n)) {
            if (
                n.length >= 2 &&
                typeof n[0] === "string" &&
                typeof n[1] === "string" &&
                n[1].length <= 5
            ) {
                const text = n[0].trim();
                const lang = n[1].toLowerCase();
                const looksLikePlace =
                    /,|\s/.test(text) && !/^©|\(c\)|google/i.test(text) && text.length >= 3;

                if (looksLikePlace) {
                    const score = (prefs.indexOf(lang) + 1) || 999;
                    const lenPenalty = Math.abs(30 - text.length) / 30;
                    const s = score + lenPenalty;
                    if (!best || s < best._score) best = { text, lang, _score: s };
                }
            }
            for (const x of n) scan(x);
        } else if (typeof n === "object" && n !== null) {
            for (const k in n) scan(n[k]);
        }
    }
    scan(node);
    return best && { place: best.text, lang: best.lang };
}

function findCoordinates(node) {
    let lat = null, lng = null;
    function scan(n) {
        if (Array.isArray(n)) {
            if (n.length >= 4 && typeof n[2] === "number" && typeof n[3] === "number") {
                lat = n[2];
                lng = n[3];
            }
            for (const x of n) scan(x);
        } else if (typeof n === "object" && n !== null) {
            for (const k in n) scan(n[k]);
        }
    }
    scan(node);
    return (lat && lng) ? { lat, lng } : null;
}

async function startCapture(tabId) {
    if (attachedTabId === tabId) return;
    if (attachedTabId !== null) await stopCapture();

    return new Promise((resolve, reject) => {
        chrome.debugger.attach({ tabId }, "1.3", () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError.message);
                return;
            }
            attachedTabId = tabId;
            chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError.message);
                    return;
                }
                resolve();
            });
        });
    });
}

async function stopCapture() {
    return new Promise((resolve) => {
        if (attachedTabId === null) return resolve();
        chrome.debugger.detach({ tabId: attachedTabId }, () => {
            attachedTabId = null;
            requestUrlById.clear();
            resolve();
        });
    });
}

chrome.debugger.onEvent.addListener((source, method, params) => {
    if (source.tabId !== attachedTabId) return;

    if (method === "Network.responseReceived") {
        const url = params?.response?.url || "";
        if (/GeoPhotoService\.GetMetadata/i.test(url) || /GeoPhotoService/i.test(url)) {
            requestUrlById.set(params.requestId, url);
            chrome.debugger.sendCommand(
                { tabId: source.tabId },
                "Network.getResponseBody",
                { requestId: params.requestId },
                (bodyObj) => {
                    if (!bodyObj) return;
                    const text = bodyObj.base64Encoded ? base64ToUtf8(bodyObj.body) : bodyObj.body;

                    let payloadText = stripJSONP(text);
                    let data = null;
                    try {
                        data = JSON.parse(payloadText);
                    } catch (e) {
                        const firstBracket = payloadText.indexOf("[");
                        const lastBracket = payloadText.lastIndexOf("]");
                        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                            try {
                                data = JSON.parse(payloadText.slice(firstBracket, lastBracket + 1));
                            } catch (_) { }
                        }
                    }

                    const when = Date.now();
                    const src = requestUrlById.get(params.requestId) || "";

                    const result = { ok: !!data, when, src, rawPreview: text.slice(0, 2000) };
                    if (data) {
                        const candidate = findPlaceCandidate(data);
                        if (candidate) {
                            result.place = candidate.place;
                            result.lang = candidate.lang;
                        }
                        // Find coordinates
                        const coords = findCoordinates(data);
                        if (coords) {
                            result.lat = coords.lat;
                            result.lng = coords.lng;
                        }
                        result.data = data;
                    }

                    chrome.storage.local.set({ lastGeoMeta: result }, () => {
                        chrome.runtime.sendMessage({ type: "geo:update" });
                    });
                }
            );
        }
    }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.cmd === "start") {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                await startCapture(tabs[0].id);
                sendResponse({ ok: true, attached: tabs[0].id });
            } catch (err) {
                sendResponse({ ok: false, error: String(err) });
            }
        });
        return true;
    }
    if (msg?.cmd === "stop") {
        stopCapture().then(() => sendResponse({ ok: true }));
        return true;
    }
    if (msg?.cmd === "status") {
        sendResponse({ attachedTabId });
    }
});
