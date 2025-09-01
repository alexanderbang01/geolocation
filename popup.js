const $ = (sel) => document.querySelector(sel);

function fmtTime(ms) {
  if (!ms) return "–";
  return new Date(ms).toLocaleString();
}

function setStatus(active) {
  const el = $("#status");
  if (active) {
    el.textContent = "Capturing";
    el.style.color = "#22c55e";
  } else {
    el.textContent = "Idle";
    el.style.color = "var(--muted)";
  }
}

// ---- Land + flag ----
function updateCountry(lat, lng) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=3&addressdetails=1`)
    .then(res => res.json())
    .then(data => {
      const country = data?.address?.country || "Ukendt";
      const code = data?.address?.country_code?.toLowerCase();

      $("#country").textContent = country;

      if (code) {
        const img = $("#flag");
        img.src = `https://flagcdn.com/w40/${code}.png`;
        img.style.display = "inline-block";
      } else {
        $("#flag").style.display = "none";
      }
    })
    .catch(() => {
      $("#country").textContent = "Ukendt";
      $("#flag").style.display = "none";
    });
}

function refreshUI(data) {
  $("#place").textContent = data?.place || "–";
  $("#lat").textContent = data?.lat ?? "–";
  $("#lng").textContent = data?.lng ?? "–";
  $("#src").textContent = data?.src || "–";
  $("#when").textContent = fmtTime(data?.when);

  if (data?.lat && data?.lng) {
    updateCountry(data.lat, data.lng);
  } else {
    $("#country").textContent = "–";
    $("#flag").style.display = "none";
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
    if (lastGeoMeta?.lat && lastGeoMeta?.lng) {
      chrome.tabs.create({
        url: `https://www.google.com/maps/search/?api=1&query=${lastGeoMeta.lat},${lastGeoMeta.lng}`
      });
    } else if (lastGeoMeta?.place) {
      chrome.tabs.create({
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lastGeoMeta.place)}`
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
    const hasCoords = lastGeoMeta?.lat != null && lastGeoMeta?.lng != null;

    if (!hasCoords) {
      frame.style.display = "none";
      img.style.display = "none";
      empty.textContent = "Ingen koordinater fundet endnu.";
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
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "maps") renderMap();
    });
  });
}

// ---- Wire UI ----
function wire() {
  $("#openMaps").addEventListener("click", openInMaps);

  // Toggle capture
  $("#toggleCapture").addEventListener("click", (e) => {
    const btn = e.target;
    if (btn.dataset.active === "true") {
      chrome.runtime.sendMessage({ cmd: "stop" }, () => {
        btn.textContent = "Start capture";
        btn.dataset.active = "false";
        setStatus(false);
      });
    } else {
      chrome.runtime.sendMessage({ cmd: "start" }, (res) => {
        if (res?.ok) {
          btn.textContent = "Stop capture";
          btn.dataset.active = "true";
          setStatus(true);
        }
      });
    }
  });

  // Reset knap
  $("#resetBtn").addEventListener("click", () => {
    chrome.storage.local.remove("lastGeoMeta", () => {
      refreshUI(null);
    });
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "geo:update") loadLast();
  });

  loadLast();
}

document.addEventListener("DOMContentLoaded", () => {
  wire();
  initTabs();
});
