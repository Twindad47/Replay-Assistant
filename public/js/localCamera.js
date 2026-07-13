import { state } from "./state.js";
import { elements, setPill, setText } from "./ui.js";

function getSupportedMimeType() {
  const types = [
    "video/webm;codecs=vp8",
    "video/webm;codecs=vp9",
    "video/webm"
  ];

  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function setLocalCameraButton(isRunning) {
  elements.startCameraButton.textContent = isRunning
    ? "Stop Camera 1"
    : "Start Camera 1";
  elements.startCameraButton.setAttribute("aria-pressed", String(isRunning));
}

export async function toggleLocalCamera(cameraManager) {
  const camera = cameraManager.getCamera("camera-1");

  if (camera?.stream && camera.status === "connected") {
    stopLocalCamera(cameraManager);
    return;
  }

  await startLocalCamera(cameraManager);
}

export async function startLocalCamera(cameraManager) {
  elements.startCameraButton.disabled = true;
  elements.startCameraButton.textContent = "Starting Camera 1…";
  setText(elements.appStatus, "Requesting access to Camera 1…");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
      },
      audio: false
    });

    state.selectedMimeType = getSupportedMimeType();
    cameraManager.setStream("camera-1", stream);

    setLocalCameraButton(true);
    setPill(elements.recordingStatus, "Ready", "is-connected");
    setText(
      elements.appStatus,
      "Camera 1 is ready. Connect another device or start an attempt."
    );
  } catch (error) {
    console.error(error);
    setLocalCameraButton(false);
    setPill(elements.recordingStatus, "Ready");
    setText(elements.appStatus, "Unable to access Camera 1.");
  } finally {
    elements.startCameraButton.disabled = false;
  }
}

export function stopLocalCamera(cameraManager) {
  cameraManager.clearStream("camera-1");
  setLocalCameraButton(false);
  setPill(elements.recordingStatus, "Ready");
  setText(elements.appStatus, "Camera 1 stopped. Start it again when ready.");
}
