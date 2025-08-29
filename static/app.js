const dropzone   = document.getElementById("dropzone");
const fileInput  = document.getElementById("file");
const browseBtn  = document.getElementById("browseBtn");
const predictBtn = document.getElementById("predictBtn");
const clearBtn   = document.getElementById("clearBtn");
const spinner    = document.getElementById("spinner");

const previewWrap = document.getElementById("previewWrap");
const preview     = document.getElementById("preview");
const fileName    = document.getElementById("fileName");
const fileSize    = document.getElementById("fileSize");
const fileType    = document.getElementById("fileType");

const statusEl   = document.getElementById("status");
const resultWrap = document.getElementById("resultWrap");
const resLabel   = document.getElementById("resLabel");
const resConf    = document.getElementById("resConf");
const confBar    = document.getElementById("confBar");
const resAlt     = document.getElementById("resAlt");
const resWhy     = document.getElementById("resWhy");
const resRaw     = document.getElementById("resRaw");

const errorWrap  = document.getElementById("errorWrap");
const errorText  = document.getElementById("errorText");

let selectedFile = null;

// ---------- helpers ----------
function bytesToSize(n) {
  const u = ['B','KB','MB','GB'];
  let i = 0;
  while (n >= 1024 && i < u.length-1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}
function showError(msg) {
  errorText.textContent = msg;
  errorWrap.classList.remove("hidden");
}
function clearError() {
  errorWrap.classList.add("hidden");
  errorText.textContent = "";
}
function resetUI(full = false) {
  clearError();
  statusEl.textContent = "";
  resultWrap.classList.add("hidden");
  resLabel.textContent = "";
  resConf.textContent = "";
  resWhy.textContent   = "";
  confBar.style.width  = "0%";
  resAlt.innerHTML     = "";
  resRaw.textContent   = "";
  if (full) {
    previewWrap.classList.add("hidden");
    preview.src = "";
    fileName.textContent = "";
    fileSize.textContent = "";
    fileType.textContent = "";
    fileInput.value = "";
    selectedFile = null;
  }
}
function setLoading(isLoading) {
  predictBtn.disabled = isLoading || !selectedFile;
  spinner.classList.toggle("hidden", !isLoading);
}

// ---------- file selection ----------
function acceptFile(file) {
  if (!file) return;
  if (!["image/png","image/jpeg","image/webp"].includes(file.type)) {
    showError("Only PNG, JPG/JPEG, WEBP are allowed.");
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showError("File too large (max 50MB).");
    return;
  }
  clearError();
  selectedFile = file;
  const url = URL.createObjectURL(file);
  preview.src = url;
  fileName.textContent = file.name;
  fileSize.textContent = `• ${bytesToSize(file.size)}`;
  fileType.textContent = `• ${file.type}`;
  previewWrap.classList.remove("hidden");
  resultWrap.classList.add("hidden");
  predictBtn.disabled = false;
}

// Click to browse
browseBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => acceptFile(e.target.files?.[0]));

// Drag & drop
["dragenter","dragover"].forEach(ev =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.add("ring-2","ring-blue-500");
  })
);
["dragleave","drop"].forEach(ev =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.remove("ring-2","ring-blue-500");
  })
);
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("drop", (e) => {
  const f = e.dataTransfer?.files?.[0];
  acceptFile(f);
});

// Clear
clearBtn.addEventListener("click", () => resetUI(true));

// ---------- predict ----------
predictBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  resetUI(false);
  setLoading(true);
  statusEl.textContent = "Uploading and predicting…";

  const t0 = performance.now();
  try {
    const fd = new FormData();
    fd.append("file", selectedFile);
    const res = await fetch("/predict", { method: "POST", body: fd });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Server error ${res.status}: ${msg}`);
    }
    const payload = await res.json();
    if (!payload.ok) throw new Error("Unexpected response.");

    const r = payload.result;
    // Render
    resLabel.textContent = r.label ?? "(no label)";
    if (typeof r.confidence === "number") {
      const pct = Math.max(0, Math.min(1, r.confidence)) * 100;
      resConf.textContent = `${pct.toFixed(0)}%`;
      confBar.style.width = `${pct}%`;
    } else {
      resConf.textContent = "—";
      confBar.style.width = "0%";
    }

    resAlt.innerHTML = "";
    (r.alternatives ?? []).forEach((alt) => {
      const chip = document.createElement("span");
      chip.className = "px-2 py-1 rounded-full bg-gray-900 text-white text-xs";
      chip.textContent = alt;
      resAlt.appendChild(chip);
    });

    resWhy.textContent = r.rationale ?? "—";
    resRaw.textContent = JSON.stringify(r, null, 2);

    resultWrap.classList.remove("hidden");
  } catch (err) {
    showError(String(err));
  } finally {
    const t1 = performance.now();
    statusEl.textContent = `Done in ${(t1 - t0).toFixed(0)} ms`;
    setLoading(false);
  }
});
