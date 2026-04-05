(() => {
  const ui = window.UtilivoUI;
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const placeholder = document.getElementById("preview-placeholder");
  const scanStatus = document.getElementById("scan-status");
  const startBtn = document.getElementById("start-camera");
  const stopBtn = document.getElementById("stop-camera");
  const pickBtn = document.getElementById("pick-image");
  const fileInput = document.getElementById("file-input");
  const resultOut = document.getElementById("result-out");
  const copyBtn = document.getElementById("copy-result");
  const clearResultBtn = document.getElementById("clear-result");

  if (
    !ui ||
    !window.UtilivoRuntime ||
    !video ||
    !canvas ||
    !placeholder ||
    !scanStatus ||
    !startBtn ||
    !stopBtn ||
    !pickBtn ||
    !fileInput ||
    !resultOut ||
    !copyBtn ||
    !clearResultBtn
  ) {
    return;
  }

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const jsQRFn = typeof window.jsQR === "function" ? window.jsQR : null;

  function debugLog() {
    try {
      if (window.UtilivoHost?.capabilities?.debugToolRuntime === true) {
        const args = Array.prototype.slice.call(arguments);
        args.unshift("[qr-code-scanner]");
        console.log.apply(console, args);
      }
    } catch (_) {}
  }

  let stream = null;
  let rafId = null;
  let lastDecodeAt = 0;
  const liveFrameMs = 90;
  const maxLiveSide = 720;
  const maxFileSide = 1200;

  /** @type {ReturnType<typeof window.UtilivoRuntime.syncState> | null} */
  let session = null;

  function emptyLabel() {
    return ui.t("result.empty");
  }

  function setResult(text) {
    const t = text != null && String(text).trim().length ? String(text).trim() : "";
    resultOut.textContent = t.length ? t : emptyLabel();
    copyBtn.disabled = !t.length;
    session?.schedulePersist();
  }

  function vibrateShort() {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(40);
      }
    } catch (_) {}
  }

  function decodeImageData(imageData) {
    if (!jsQRFn || !imageData) {
      return null;
    }
    try {
      return jsQRFn(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });
    } catch (_) {
      return null;
    }
  }

  function drawToCanvasScaled(source, maxSide) {
    const w = source.width || source.videoWidth;
    const h = source.height || source.videoHeight;
    if (!w || !h) {
      return false;
    }
    let tw = w;
    let th = h;
    const longest = Math.max(w, h);
    if (longest > maxSide) {
      const r = maxSide / longest;
      tw = Math.round(w * r);
      th = Math.round(h * r);
    }
    canvas.width = tw;
    canvas.height = th;
    ctx.drawImage(source, 0, 0, w, h, 0, 0, tw, th);
    return true;
  }

  function applyDecode(code) {
    if (!code || !code.data) {
      return false;
    }
    stopCameraInternal();
    setResult(code.data);
    scanStatus.hidden = true;
    vibrateShort();
    return true;
  }

  function stopCameraInternal() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (stream) {
      stream.getTracks().forEach((tr) => {
        tr.stop();
      });
      stream = null;
    }
    video.srcObject = null;
    video.hidden = true;
    placeholder.hidden = false;
    startBtn.hidden = false;
    stopBtn.hidden = true;
  }

  async function loadImageSource(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(file);
      } catch (_) {
        /* fall through */
      }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("image"));
      };
      img.src = url;
    });
  }

  function userMessageForGetUserMediaError(err) {
    const name = err && err.name ? String(err.name) : "";
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return ui.t("errors.cameraNotFound");
    }
    if (
      name === "OverconstrainedError" ||
      name === "ConstraintNotSatisfiedError"
    ) {
      return ui.t("errors.cameraFailed");
    }
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return ui.t("errors.cameraDenied");
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return ui.t("errors.cameraFailed");
    }
    return ui.t("errors.cameraFailed");
  }

  async function startCamera() {
    stopCameraInternal();
    scanStatus.hidden = true;
    debugLog("startCamera");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      debugLog("getUserMedia missing", {
        mediaDevices: !!navigator.mediaDevices,
      });
      scanStatus.textContent = ui.t("errors.cameraFailed");
      scanStatus.hidden = false;
      return;
    }
    const constraintAttempts = [
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      { video: { facingMode: "environment" }, audio: false },
      { video: true, audio: false },
    ];
    let lastErr = null;
    for (let i = 0; i < constraintAttempts.length; i += 1) {
      const constraints = constraintAttempts[i];
      try {
        debugLog("getUserMedia try", i, constraints);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        lastErr = null;
        debugLog("getUserMedia ok", i);
        break;
      } catch (err) {
        lastErr = err;
        debugLog("getUserMedia error", i, err && err.name, err && err.message, err);
      }
    }
    if (!stream) {
      debugLog("getUserMedia gave up", lastErr);
      scanStatus.textContent = userMessageForGetUserMediaError(lastErr);
      scanStatus.hidden = false;
      return;
    }
    video.srcObject = stream;
    video.hidden = false;
    placeholder.hidden = true;
    startBtn.hidden = true;
    stopBtn.hidden = false;
    scanStatus.textContent = ui.t("state.scanning");
    scanStatus.hidden = false;
    await video.play().catch(() => {});

    const tick = () => {
      if (!stream) {
        return;
      }
      if (!video.videoWidth) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const now = performance.now();
      if (now - lastDecodeAt >= liveFrameMs) {
        lastDecodeAt = now;
        if (drawToCanvasScaled(video, maxLiveSide)) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = decodeImageData(imageData);
          if (applyDecode(code)) {
            return;
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  async function handleFile(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      return;
    }
    scanStatus.hidden = true;
    let source;
    try {
      source = await loadImageSource(file);
    } catch (_) {
      scanStatus.textContent = ui.t("errors.imageReadFailed");
      scanStatus.hidden = false;
      return;
    }
    try {
      if (!drawToCanvasScaled(source, maxFileSide)) {
        scanStatus.textContent = ui.t("errors.imageReadFailed");
        scanStatus.hidden = false;
        return;
      }
      if (typeof source.close === "function") {
        source.close();
      }
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = decodeImageData(imageData);
      if (!code || !code.data) {
        scanStatus.textContent = ui.t("errors.decodeFailed");
        scanStatus.hidden = false;
        return;
      }
      applyDecode(code);
    } catch (_) {
      scanStatus.textContent = ui.t("errors.imageReadFailed");
      scanStatus.hidden = false;
    }
  }

  async function bootstrap() {
    ui.ensureToolPage();
    await ui.initLocalization({
      defaultLocale: "en",
      supportedLocales: ["en"],
      basePath: "./locales",
    });
    ui.applyTranslations(document);

    if (!jsQRFn) {
      scanStatus.textContent = ui.t("errors.jsqrMissing");
      scanStatus.hidden = false;
    }

    function getSerializableState() {
      const cur = resultOut.textContent;
      return {
        v: 1,
        lastResult: cur === emptyLabel() ? "" : cur,
      };
    }

    function applySerializableState(data) {
      if (!data || typeof data !== "object" || data.v !== 1) {
        return;
      }
      if (typeof data.lastResult === "string" && data.lastResult.length) {
        setResult(data.lastResult);
      }
    }

    session = window.UtilivoRuntime.syncState({
      read: getSerializableState,
      write: applySerializableState,
      debounceMs: 400,
    });
    await session.hydrateFromHost();

    startBtn.addEventListener("click", () => {
      void startCamera();
    });
    stopBtn.addEventListener("click", () => {
      stopCameraInternal();
      scanStatus.hidden = true;
    });

    pickBtn.addEventListener("click", async () => {
      const record = window.utilivo?.recordStorageAction;
      if (typeof record !== "function") {
        scanStatus.textContent = ui.t("errors.noImagePicker");
        scanStatus.hidden = false;
        return;
      }
      let ok = false;
      try {
        ok = await Promise.resolve(record());
      } catch (_) {
        ok = false;
      }
      if (!ok) {
        scanStatus.textContent = ui.t("errors.storageDenied");
        scanStatus.hidden = false;
        return;
      }
      scanStatus.hidden = true;
      fileInput.click();
    });

    fileInput.addEventListener("change", () => {
      const f = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (f) {
        void handleFile(f);
      }
    });

    copyBtn.addEventListener("click", async () => {
      const text = resultOut.textContent;
      if (!text || text === emptyLabel()) {
        return;
      }
      const copiedMsg = ui.t("result.copied");
      try {
        await navigator.clipboard.writeText(text);
        scanStatus.textContent = copiedMsg;
        scanStatus.hidden = false;
        global.setTimeout(() => {
          if (scanStatus.textContent === copiedMsg) {
            scanStatus.hidden = true;
          }
        }, 2000);
      } catch (_) {
        scanStatus.textContent = ui.t("result.copyFailed");
        scanStatus.hidden = false;
      }
    });

    clearResultBtn.addEventListener("click", () => {
      setResult("");
      scanStatus.hidden = true;
      session.persistNow();
    });
  }

  bootstrap().catch((err) => {
    console.error(err);
  });
})();
