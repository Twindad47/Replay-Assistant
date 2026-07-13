import {
  formatSessionCode,
  getOrCreateCameraKey,
  getSessionCodeFromUrl,
  isValidSessionCode,
  normalizeSessionCode,
  updateSessionInUrl
} from "./session.js";
import { getRtcConfig } from "./webrtcConfig.js";

const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 10000,
  randomizationFactor: 0.35
});

const joinPanel = document.getElementById("cameraJoinPanel");
const controlPanel = document.getElementById("cameraControlPanel");
const sessionInput = document.getElementById("cameraSessionInput");
const joinButton = document.getElementById("joinCameraSessionButton");
const joinError = document.getElementById("cameraJoinError");
const sessionCodeText = document.getElementById("cameraSessionCode");
const socketStatus = document.getElementById("cameraSocketStatus");
const preview = document.getElementById("cameraPreview");
const startButton = document.getElementById("startRemoteCameraButton");
const consentCheckbox = document.getElementById("recordingConsent");
const statusText = document.getElementById("cameraPageStatus");
const assignedName = document.getElementById("assignedCameraName");
const feedbackLink = document.getElementById("cameraFeedbackLink");

let sessionCode = getSessionCodeFromUrl();
let cameraKey = sessionCode ? getOrCreateCameraKey(sessionCode) : "";
let cameraId = null;
let cameraName = "Camera";
let stream = null;
let isStarting = false;
const peers = new Map();
const pendingCandidates = new Map();

initialize();

function initialize() {
  if (!sessionCode) {
    joinPanel.classList.remove("is-hidden");
    controlPanel.classList.add("is-hidden");
    sessionInput.focus();
  } else {
    joinPanel.classList.add("is-hidden");
    controlPanel.classList.remove("is-hidden");
    sessionCodeText.textContent = formatSessionCode(sessionCode);

    const feedbackUrl = new URL(feedbackLink.href, window.location.href);
    feedbackUrl.searchParams.set("session", sessionCode);
    feedbackLink.href = feedbackUrl.href;
  }

  updateStartButtonAvailability();
}

joinButton.addEventListener("click", joinEnteredSession);
sessionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinEnteredSession();
});

function joinEnteredSession() {
  const code = normalizeSessionCode(sessionInput.value);
  if (!isValidSessionCode(code)) {
    joinError.textContent = "Enter the 6-character session code shown on the controller.";
    return;
  }

  joinError.textContent = "";
  updateSessionInUrl(code, { reload: true });
}

consentCheckbox.addEventListener("change", updateStartButtonAvailability);

function updateStartButtonAvailability() {
  startButton.disabled = isStarting || (!stream && !consentCheckbox.checked);
}

function setSocketStatus(mode, label) {
  socketStatus.textContent = label;
  socketStatus.className = "connection-badge";
  socketStatus.classList.add(`is-${mode}`);
}

function setButtonState(isRunning) {
  const label = cameraId ? cameraName : "Camera";
  startButton.textContent = `${isRunning ? "Stop" : "Start"} ${label}`;
  startButton.setAttribute("aria-pressed", String(isRunning));
  updateStartButtonAvailability();
}

function joinCamera() {
  if (!sessionCode || !cameraKey || !stream) return;
  socket.emit("join-camera", { sessionCode, cameraKey });
}

socket.on("connect", () => {
  setSocketStatus("connected", "Online");
  statusText.textContent = stream
    ? "Reconnected. Rejoining the private session…"
    : "Connected. Confirm permission, then tap Start Camera.";

  if (stream) joinCamera();
});

socket.on("disconnect", () => {
  setSocketStatus("connecting", "Reconnecting");
  statusText.textContent = "Connection lost. Replay Assistant is reconnecting…";
});

socket.io.on("reconnect_attempt", () => {
  setSocketStatus("connecting", "Reconnecting");
});

socket.io.on("reconnect_failed", () => {
  setSocketStatus("failed", "Offline");
  statusText.textContent = "Unable to reconnect. Check this device’s internet connection.";
});

startButton.addEventListener("click", async () => {
  if (stream) {
    stopRemoteCamera();
    return;
  }

  await startRemoteCamera();
});

async function startRemoteCamera() {
  if (isStarting || !sessionCode || !consentCheckbox.checked) return;
  isStarting = true;
  updateStartButtonAvailability();
  startButton.textContent = "Starting Camera…";

  try {
    statusText.textContent = "Requesting camera permission…";

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
      },
      audio: false
    });

    preview.srcObject = stream;
    await preview.play();
    setButtonState(true);
    statusText.textContent = "Camera started. Joining the private session…";
    joinCamera();
  } catch (error) {
    console.error("Remote camera error:", error);
    stream = null;
    preview.srcObject = null;
    setButtonState(false);
    statusText.textContent = error?.name === "NotAllowedError"
      ? "Camera permission was denied. Allow camera access in browser settings and try again."
      : "Unable to access this device camera.";
  } finally {
    isStarting = false;
    updateStartButtonAvailability();
  }
}

function stopRemoteCamera() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  preview.pause();
  preview.srcObject = null;

  closeAllPeers();

  if (cameraId) {
    socket.emit("camera-stopped", { cameraId });
  }

  setButtonState(false);
  statusText.textContent = `${cameraName} stopped. Tap Start ${cameraName} to resume.`;
}

function closeAllPeers() {
  for (const peer of peers.values()) peer.close();
  peers.clear();
  pendingCandidates.clear();
}

socket.on("camera-assigned", ({ cameraId: id, defaultName, sessionCode: assignedSession }) => {
  if (assignedSession !== sessionCode) return;
  cameraId = id;
  cameraName = defaultName;
  assignedName.textContent = defaultName;
  setButtonState(Boolean(stream));
  statusText.textContent = "Camera assigned. Waiting for a controller…";
});

socket.on("offer", async ({ cameraId: target, controllerId, offer }) => {
  if (target !== cameraId || !stream || !controllerId || !offer) return;

  peers.get(controllerId)?.close();
  const activePeer = new RTCPeerConnection(await getRtcConfig());
  peers.set(controllerId, activePeer);
  stream.getTracks().forEach((track) => activePeer.addTrack(track, stream));

  activePeer.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      socket.emit("camera-ice-candidate", {
        cameraId,
        controllerId,
        candidate: event.candidate
      });
    }
  });

  activePeer.addEventListener("connectionstatechange", () => {
    if (peers.get(controllerId) !== activePeer || !stream) return;

    if (activePeer.connectionState === "connected") {
      statusText.textContent = "Connected to the Replay Assistant controller.";
    } else if (["failed", "closed"].includes(activePeer.connectionState)) {
      peers.delete(controllerId);
      statusText.textContent = "Controller connection changed. Waiting to reconnect…";
    }
  });

  try {
    await activePeer.setRemoteDescription(offer);

    for (const candidate of pendingCandidates.get(controllerId) || []) {
      await activePeer.addIceCandidate(candidate);
    }
    pendingCandidates.delete(controllerId);

    const answer = await activePeer.createAnswer();
    await activePeer.setLocalDescription(answer);

    socket.emit("camera-answer", {
      cameraId,
      controllerId,
      answer: activePeer.localDescription
    });
  } catch (error) {
    console.error("Unable to answer controller offer.", error);
    activePeer.close();
    peers.delete(controllerId);
  }
});

socket.on("ice-candidate", async ({ cameraId: target, controllerId, candidate }) => {
  if (target !== cameraId || !candidate || !stream || !controllerId) return;

  const peer = peers.get(controllerId);

  try {
    if (peer?.remoteDescription) {
      await peer.addIceCandidate(candidate);
    } else {
      const pending = pendingCandidates.get(controllerId) || [];
      pending.push(candidate);
      pendingCandidates.set(controllerId, pending);
    }
  } catch (error) {
    console.warn("Unable to add controller ICE candidate.", error);
  }
});

socket.on("controller-disconnected", ({ controllerId }) => {
  peers.get(controllerId)?.close();
  peers.delete(controllerId);
  pendingCandidates.delete(controllerId);

  if (stream && peers.size === 0) {
    statusText.textContent = "Controller disconnected. Waiting for it to reconnect…";
  }
});

socket.on("camera-replaced", () => {
  stopRemoteCamera();
  statusText.textContent = "This camera connection was opened on another browser tab or device.";
});

socket.on("session-error", ({ message } = {}) => {
  setSocketStatus("failed", "Session Error");
  statusText.textContent = message || "Unable to join this private session.";
});
