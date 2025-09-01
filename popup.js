const $ = (sel) => document.querySelector(sel);

function fmtTime(ms) {
  if (!ms) return "–";
  return new Date(ms).toLocaleString();
}

function setStatus(text, color = "var(--muted)") {
  const el = $("#status");
  el.textContent = text;
  el.style.color = color;
}

function stripJSONP(text) {
  if (!text) return "";
  const first = text.indexOf("(");
  const last = text.lastIndexOf(")");
  if (first !== -1 && last !== -1 && last > first) return text.slice(first + 1, last);
  return text;
}

function safeParsePayload(text) {
  let payloadText = stripJSONP(text);
  let data = null;
  try {
    data = JSON.parse(payloadText);
  } catch (_) {
    const firstBracket = payloadText.indexOf("[");
    const lastBracket = payloadText.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      try {
        data = JSON.parse(payloadText.slice(firstBracket, lastBracket + 1));
      } catch (_) { }
    }
  }
  return data;
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
          /,|\s/.test(text) &&
          !/^©|\(c\)|google/i.test(text) &&
          text.length >= 3;
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
  let lat = null,
    lng = null;
  function scan(n) {
    if (Array.isArray(n)) {
      if (
        n.length >= 4 &&
        typeof n[2] === "number" &&
        typeof n[3] === "number"
      ) {
        lat = n[2];
        lng = n[3];
      }
      for (const x of n) scan(x);
    } else if (typeof n === "object" && n !== null) {
      for (const k in n) scan(n[k]);
    }
  }
  scan(node);
  return lat != null && lng != null ? { lat, lng } : null;
}

function parseGeoResponse(rawText) {
  const data = safeParsePayload(rawText);
  const result = { ok: !!data, data };
  if (data) {
    const cand = findPlaceCandidate(data);
    if (cand) {
      result.place = cand.place;
      result.lang = cand.lang;
    }
    const coords = findCoordinates(data);
    if (coords) {
      result.lat = coords.lat;
      result.lng = coords.lng;
    }
  }
  return result;
}

// ---- Loading dots ----
const dotIntervals = {};

function startDots(el) {
  if (!el) return;
  stopDots(el); // sikrer ingen dobbelt
  let dots = 0;
  dotIntervals[el.id] = setInterval(() => {
    dots = (dots + 1) % 4;
    el.textContent = dots === 0 ? "" : ".".repeat(dots);
  }, 500);
}

function stopDots(el, text) {
  if (!el) return;
  if (dotIntervals[el.id]) {
    clearInterval(dotIntervals[el.id]);
    delete dotIntervals[el.id];
  }
  el.textContent = text ?? "–";
}

// ---- Country + flag ----
function updateCountry(lat, lng) {
  const countryEl = $("#country");
  const flagEl = $("#flag");
  const flagTextEl = $("#flagText");

  startDots(countryEl);
  startDots(flagTextEl);
  flagEl.style.display = "none";
  flagTextEl.style.display = "block";

  fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=3&addressdetails=1&accept-language=en`
  )
    .then((res) => res.json())
    .then((data) => {
      const country = data?.address?.country || "Ukendt";
      const code = data?.address?.country_code?.toLowerCase();

      stopDots(countryEl, country);

      if (code) {
        flagEl.src = `https://flagcdn.com/w40/${code}.png`;
        flagEl.style.display = "inline-block";
        flagTextEl.style.display = "none";
        stopDots(flagTextEl, "–");
      } else {
        flagEl.style.display = "none";
        stopDots(flagTextEl, "–");
      }
    })
    .catch(() => {
      stopDots(countryEl, "Ukendt");
      flagEl.style.display = "none";
      stopDots(flagTextEl, "–");
    });
}

function refreshUI(data) {
  // stop dots først
  ["place", "country", "lat", "lng", "src", "when", "flagText"].forEach(
    (id) => {
      stopDots($(`#${id}`));
    }
  );

  $("#place").textContent = data?.place || "–";
  $("#lat").textContent = data?.lat ?? "–";
  $("#lng").textContent = data?.lng ?? "–";
  $("#src").textContent = data?.src || "–";
  $("#when").textContent = fmtTime(data?.when);

  if (data?.lat != null && data?.lng != null) {
    updateCountry(data.lat, data.lng);
  } else {
    $("#country").textContent = "–";
    $("#flag").style.display = "none";
    $("#flagText").style.display = "block";
    $("#flagText").textContent = "–";
  }

  if ($("#maps").classList.contains("active")) renderMap();
}

function loadLast(cb) {
  chrome.storage.local.get("lastGeoMeta", ({ lastGeoMeta }) => {
    refreshUI(lastGeoMeta || null);
    cb && cb(lastGeoMeta || null);
  });
}

function openInMaps() {
  chrome.storage.local.get("lastGeoMeta", ({ lastGeoMeta }) => {
    if (lastGeoMeta?.lat != null && lastGeoMeta?.lng != null) {
      chrome.tabs.create({
        url: `https://www.google.com/maps/search/?api=1&query=${lastGeoMeta.lat},${lastGeoMeta.lng}`,
      });
    } else if (lastGeoMeta?.place) {
      chrome.tabs.create({
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          lastGeoMeta.place
        )}`,
      });
    }
  });
}

// ---- MAPS TAB ----
function buildStaticMapURL(lat, lng, wrap) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(300, Math.round((wrap?.clientWidth || 320) * dpr));
  const h = Math.max(220, Math.round((wrap?.clientHeight || 300) * dpr));
  const z = 12;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${z}&size=${w}x${h}&markers=${lat},${lng},red-pushpin`;
}

function renderMap() {
  const wrap = $("#mapWrap");
  const frame = $("#mapFrame");
  const img = $("#mapImg");
  const empty = $("#mapEmpty");

  chrome.storage.local.get("lastGeoMeta", ({ lastGeoMeta }) => {
    const hasCoords =
      lastGeoMeta?.lat != null && lastGeoMeta?.lng != null;

    if (!hasCoords) {
      frame.style.display = "none";
      img.style.display = "none";
      empty.textContent = "No coordinates found.";
      empty.style.display = "block";
      return;
    }

    const { lat, lng, place } = lastGeoMeta;

    let loaded = false;
    empty.style.display = "none";
    img.style.display = "none";

    const url = `https://www.google.com/maps?q=${lat},${lng}&z=12&hl=da&output=embed`;
    frame.src = url;
    frame.onload = () => {
      loaded = true;
      frame.style.display = "block";
      img.style.display = "none";
      empty.style.display = "none";
    };

    setTimeout(() => {
      if (loaded) return;
      frame.style.display = "none";
      img.src = buildStaticMapURL(lat, lng, wrap);
      img.onload = () => {
        img.style.display = "block";
        empty.style.display = "none";
      };
      img.onerror = () => {
        img.style.display = "none";
        empty.textContent = "Kunne ikke hente kortet.";
        empty.style.display = "block";
      };
    }, 1200);

    wrap.title = place ? `${place}\n(${lat}, ${lng})` : `(${lat}, ${lng})`;
  });
}

// ---- Tabs ----
function initTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "maps") renderMap();
    });
  });
}

// ---- Wire UI ----
function wire() {
  $("#openMaps").addEventListener("click", openInMaps);

  $("#fetchBtn").addEventListener("click", () => {
    setStatus("Henter...", "#fbbf24");

    // Start prikker på alle felter
    ["place", "country", "lat", "lng", "src", "when", "flagText"].forEach(
      (id) => {
        const el = $(`#${id}`);
        if (el) startDots(el);
      }
    );
    $("#flag").style.display = "none";
    $("#flagText").style.display = "block";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs && tabs[0] && tabs[0].id;
      if (!tabId) {
        setStatus("Ingen faneblad", "#ef4444");
        return;
      }
      chrome.tabs.sendMessage(
        tabId,
        { action: "getMetadataRequests" },
        (res) => {
          if (!res || !Array.isArray(res.requests) || res.requests.length === 0) {
            setStatus("No data", "#ef4444");
            return;
          }
          const last =
            [...res.requests]
              .reverse()
              .find(
                (x) =>
                  /GetMetadata|GeoPhotoService/i.test(x.url) &&
                  typeof x.response === "string"
              ) || res.requests[res.requests.length - 1];

          const parsed = parseGeoResponse(last.response || "");
          const record = {
            ok: parsed.ok,
            when: Date.now(),
            src: last.url || "–",
            place: parsed.place,
            lang: parsed.lang,
            lat: parsed.lat,
            lng: parsed.lng,
            rawPreview: (last.response || "").slice(0, 2000),
            data: parsed.data,
          };

          chrome.storage.local.set({ lastGeoMeta: record }, () => {
            loadLast();
            setStatus(
              record.ok ? "OK" : "Ukendt format",
              record.ok ? "#22c55e" : "#f59e0b"
            );
          });
        }
      );
    });
  });

  $("#resetBtn").addEventListener("click", () => {
    chrome.storage.local.remove("lastGeoMeta", () => {
      // stop prikker og sæt tilbage til bindestreg
      ["place", "country", "lat", "lng", "src", "when", "flagText"].forEach(
        (id) => {
          stopDots($(`#${id}`), "–");
        }
      );
      $("#flag").style.display = "none";
      $("#flagText").style.display = "block";
      $("#flagText").textContent = "–";
      setStatus("Idle");
    });
  });

  loadLast();
}

document.addEventListener("DOMContentLoaded", () => {
  wire();
  initTabs();
});
