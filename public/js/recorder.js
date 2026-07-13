import { state } from "./state.js";
import { elements, setControlsLocked, setPill, setText } from "./ui.js";

let overlayHideTimer = null;

export function startAttempt(cameraManager) {
  const cameras = cameraManager.getConnectedRecordable();

  if (!cameras.length) {
    setText(elements.appStatus, "Connect at least one camera first.");
    return;
  }

  state.lastAttemptBlob = null;
  state.lastAttemptMetadata = null;
  state.recorderChunks = [];
  state.recordingFinalized = false;

  if (state.recordingStopFallback) {
    clearTimeout(state.recordingStopFallback);
    state.recordingStopFallback = null;
  }
  elements.replayButton.disabled = true;
  elements.saveReplayButton.disabled = true;
  setControlsLocked(true);
  setPill(elements.recordingStatus, "Get Ready");

  let count = 3;
  showCountdownValue(count, "ready");
  setText(elements.appStatus, "Get ready...");

  const timer = setInterval(() => {
    count -= 1;

    if (count > 0) {
      showCountdownValue(count, "ready");
      return;
    }

    clearInterval(timer);
    showCountdownValue("GO!", "ready");

    setTimeout(() => {
      recordAttempt(cameraManager);
    }, 800);
  }, 1000);
}

function showCountdownValue(value, mode = "ready") {
  const displayValue = String(value);

  if (overlayHideTimer) {
    clearTimeout(overlayHideTimer);
    overlayHideTimer = null;
  }

  elements.countdown.textContent = displayValue;

  if (elements.countdownOverlayValue) {
    elements.countdownOverlayValue.textContent = displayValue;
    elements.countdownOverlayValue.classList.remove("countdown-pop");
    void elements.countdownOverlayValue.offsetWidth;
    elements.countdownOverlayValue.classList.add("countdown-pop");
  }

  if (elements.countdownOverlay) {
    elements.countdownOverlay.classList.remove(
      "is-recording-countdown",
      "is-processing-countdown",
      "is-replay-ready"
    );

    if (mode === "recording") {
      elements.countdownOverlay.classList.add("is-recording-countdown");
    } else if (mode === "processing") {
      elements.countdownOverlay.classList.add("is-processing-countdown");
    } else if (mode === "replay-ready") {
      elements.countdownOverlay.classList.add("is-replay-ready");
    }

    elements.countdownOverlay.classList.add("is-visible");
    elements.countdownOverlay.setAttribute("aria-hidden", "false");
  }
}

function hideCountdownValue() {
  elements.countdown.textContent = "";

  if (elements.countdownOverlay) {
    elements.countdownOverlay.classList.remove(
      "is-visible",
      "is-recording-countdown",
      "is-processing-countdown",
      "is-replay-ready"
    );
    elements.countdownOverlay.setAttribute("aria-hidden", "true");
  }

  if (elements.countdownOverlayValue) {
    elements.countdownOverlayValue.textContent = "";
    elements.countdownOverlayValue.classList.remove("countdown-pop");
  }
}

function hideCountdownAfter(delay) {
  if (overlayHideTimer) clearTimeout(overlayHideTimer);
  overlayHideTimer = setTimeout(() => {
    hideCountdownValue();
    overlayHideTimer = null;
  }, delay);
}

function recordAttempt(cameraManager) {
  const cameras = cameraManager.getConnectedRecordable();
  const duration = Number(elements.recordingLength.value);

  configureCanvas(cameras.length);
  startCanvasDrawing(cameras);

  state.recordingStream = elements.recordingCanvas.captureStream(30);
  state.recorder = new MediaRecorder(
    state.recordingStream,
    state.selectedMimeType ? { mimeType: state.selectedMimeType } : undefined
  );

  state.recorder.addEventListener("dataavailable", (event) => {
    if (event.data?.size > 0) state.recorderChunks.push(event.data);
  });

  state.recorder.addEventListener("stop", () => finishRecording(cameraManager, cameras, duration));
  state.recorder.start();

  setPill(elements.recordingStatus, "Recording…", "is-recording");

  let remaining = duration;
  showCountdownValue(remaining, "recording");
  setText(elements.appStatus, `Recording... ${remaining} seconds remaining`);

  state.recordingTimer = setInterval(() => {
    remaining -= 1;

    if (remaining > 0) {
      showCountdownValue(remaining, "recording");
      setText(elements.appStatus, `Recording... ${remaining} seconds remaining`);
      return;
    }

    clearInterval(state.recordingTimer);
    state.recordingTimer = null;

    showCountdownValue("PROCESSING", "processing");
    setPill(elements.recordingStatus, "Finishing…", "is-connecting");
    setText(elements.appStatus, "Finishing replay...");

    try {
      if (state.recorder?.state === "recording") {
        try {
          state.recorder.requestData();
        } catch (error) {
          console.warn("Unable to request the final recorder data chunk.", error);
        }

        state.recorder.stop();
      } else {
        finishRecording(cameraManager, cameras, duration);
      }
    } catch (error) {
      console.error("Unable to stop the recording cleanly.", error);
      finishRecording(cameraManager, cameras, duration);
    }

    state.recordingStopFallback = setTimeout(() => {
      finishRecording(cameraManager, cameras, duration);
    }, 2000);
  }, 1000);
}

function finishRecording(cameraManager, cameras, duration) {
  if (state.recordingFinalized) return;
  state.recordingFinalized = true;

  if (state.recordingStopFallback) {
    clearTimeout(state.recordingStopFallback);
    state.recordingStopFallback = null;
  }

  cleanup();

  const recorderMimeType = state.recorder?.mimeType;

  state.lastAttemptBlob = new Blob(state.recorderChunks, {
    type: recorderMimeType || state.selectedMimeType || "video/webm"
  });

  state.lastAttemptMetadata = {
    duration,
    cameraNames: cameras.map((camera) => camera.name),
    replaySpeed: 0.5,
    createdAt: new Date().toISOString()
  };

  elements.replayButton.disabled = false;
  elements.saveReplayButton.disabled = false;
  setControlsLocked(false);
  setPill(elements.recordingStatus, "Replay Ready", "is-complete");
  setText(elements.appStatus, "Attempt recorded. Replay it or save it.");
  showCountdownValue("REPLAY READY", "replay-ready");
  hideCountdownAfter(1400);

  cameraManager.notifyChange();
}

function configureCanvas(count) {
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  elements.recordingCanvas.width = columns * 960;
  elements.recordingCanvas.height = rows * 540;
}

function startCanvasDrawing(cameras) {
  const context = elements.recordingCanvas.getContext("2d");
  const columns = Math.ceil(Math.sqrt(cameras.length));
  const rows = Math.ceil(cameras.length / columns);
  const cellWidth = elements.recordingCanvas.width / columns;
  const cellHeight = elements.recordingCanvas.height / rows;

  const draw = () => {
    context.fillStyle = "#000";
    context.fillRect(0, 0, elements.recordingCanvas.width, elements.recordingCanvas.height);

    cameras.forEach((camera, index) => {
      const x = (index % columns) * cellWidth;
      const y = Math.floor(index / columns) * cellHeight;

      drawContain(context, camera.videoElement, x, y, cellWidth, cellHeight);

      context.fillStyle = "rgba(0,0,0,.65)";
      context.fillRect(x, y, cellWidth, 44);
      context.fillStyle = "#fff";
      context.font = "28px Arial";
      context.fillText(camera.name, x + 16, y + 31);
      context.strokeStyle = "#fff";
      context.lineWidth = 4;
      context.strokeRect(x, y, cellWidth, cellHeight);
    });

    state.canvasAnimationFrame = requestAnimationFrame(draw);
  };

  draw();
}

function drawContain(context, video, x, y, width, height) {
  if (!video || video.readyState < 2 || !video.videoWidth) return;

  const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
  const drawWidth = video.videoWidth * scale;
  const drawHeight = video.videoHeight * scale;

  context.drawImage(
    video,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
}

function cleanup() {
  if (state.canvasAnimationFrame) {
    cancelAnimationFrame(state.canvasAnimationFrame);
    state.canvasAnimationFrame = null;
  }

  if (state.recordingStream) {
    state.recordingStream.getTracks().forEach((track) => track.stop());
    state.recordingStream = null;
  }
}
