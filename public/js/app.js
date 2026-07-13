import { CameraManager } from "./cameraManager.js";
import { elements, setPill, setText } from "./ui.js";
import { toggleLocalCamera } from "./localCamera.js";
import { setupRemoteCameraReceiver } from "./remoteCameraReceiver.js";
import { startAttempt } from "./recorder.js";
import { openCurrentReplay } from "./replay.js";
import { setupGallery } from "./gallery.js";
import {
  buildCameraUrl,
  ensureControllerSession,
  formatSessionCode,
  updateSessionInUrl
} from "./session.js";

const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 10000,
  randomizationFactor: 0.35
});

initialize().catch((error) => {
  console.error("Unable to start Replay Assistant.", error);
  setText(elements.appStatus, "Replay Assistant could not create a private session. Refresh the page to try again.");
  setSocketStatus("failed", "Session Error");
});

async function initialize() {
  const sessionCode = await ensureControllerSession();
  const pageUrl = new URL(window.location.href);
  const coachControllerMode = pageUrl.searchParams.get("mode") === "coach";

  const cameraManager = new CameraManager(elements.cameraGrid, {
    onChange(manager) {
      const controlsAreLocked = elements.recordingLength.disabled;
      const hasConnectedCamera = manager.getConnectedRecordable().length > 0;
      elements.startAttemptButton.disabled = controlsAreLocked || !hasConnectedCamera;
    }
  });

  configureSessionPanel(sessionCode);
  configureControllerMode(sessionCode, coachControllerMode);
  configurePrivacyNotice();
  configureFeedbackLinks(sessionCode);

  if (!coachControllerMode) {
    cameraManager.addCamera({
      id: "camera-1",
      name: "Camera 1",
      type: "local",
      status: "offline"
    });

    elements.startCameraButton.addEventListener("click", () => {
      toggleLocalCamera(cameraManager);
    });
  } else {
    elements.startCameraButton.classList.add("is-hidden");
    elements.startCameraButton.disabled = true;
    setPill(elements.recordingStatus, "Waiting for Cameras");
    setText(
      elements.appStatus,
      "Coach Controller Mode is ready. Scan the QR code with another phone or tablet to add a camera."
    );
  }

  elements.startAttemptButton.addEventListener("click", () => {
    startAttempt(cameraManager);
  });

  elements.replayButton.addEventListener("click", openCurrentReplay);

  setupRemoteCameraReceiver(socket, cameraManager, {
    sessionCode,
    onSocketStatus: (mode) => {
      if (mode === "connected") setSocketStatus("connected", "Online");
      else if (mode === "failed") setSocketStatus("failed", "Offline");
      else setSocketStatus("connecting", "Reconnecting");
    },
    onSessionError: (message) => {
      setSocketStatus("failed", "Session Error");
      setText(elements.appStatus, message);
    }
  });

  setupGallery();

  window.replayAssistant = {
    cameraManager,
    coachControllerMode,
    sessionCode
  };
}

function setSocketStatus(mode, label) {
  if (!elements.socketStatus) return;
  elements.socketStatus.textContent = label;
  elements.socketStatus.className = "connection-badge";
  elements.socketStatus.classList.add(`is-${mode}`);
}

function configureSessionPanel(sessionCode) {
  const cameraUrl = buildCameraUrl(sessionCode);
  const formattedCode = formatSessionCode(sessionCode);

  document.body.dataset.sessionCode = sessionCode;
  setText(elements.sessionCodeDisplay, formattedCode);
  setText(elements.coachCameraUrl, cameraUrl);

  if (elements.sessionQrImage) {
    elements.sessionQrImage.src = `/api/sessions/${encodeURIComponent(sessionCode)}/qr.png`;
  }

  elements.copySessionCodeButton?.addEventListener("click", () => {
    copyText(sessionCode, elements.copySessionCodeButton, "Code Copied");
  });

  elements.copyCameraLinkButton?.addEventListener("click", () => {
    copyText(cameraUrl, elements.copyCameraLinkButton, "Link Copied");
  });

  elements.newSessionButton?.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Create a new private session? Existing camera links will no longer join this controller page."
    );
    if (!confirmed) return;

    elements.newSessionButton.disabled = true;
    elements.newSessionButton.textContent = "Creating…";

    try {
      const response = await fetch("/api/sessions", { method: "POST" });
      if (!response.ok) throw new Error("Unable to create session.");
      const result = await response.json();
      updateSessionInUrl(result.sessionCode, { reload: true });
    } catch (error) {
      console.error(error);
      elements.newSessionButton.disabled = false;
      elements.newSessionButton.textContent = "New Session";
      setText(elements.appStatus, "Unable to create a new session. Try again in a moment.");
    }
  });
}

async function copyText(text, button, successLabel) {
  const originalLabel = button?.textContent || "Copy";

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.warn("Clipboard access was unavailable.", error);
    window.prompt("Copy this text:", text);
    return;
  }

  if (!button) return;
  button.textContent = successLabel;
  setTimeout(() => {
    button.textContent = originalLabel;
  }, 1500);
}

function configureControllerMode(sessionCode, coachControllerMode) {
  const basePageUrl = new URL(window.location.href);
  basePageUrl.searchParams.delete("mode");
  basePageUrl.searchParams.set("session", sessionCode);

  if (elements.coachModeLink) {
    if (coachControllerMode) {
      elements.coachModeLink.textContent = "Standard Mode";
      elements.coachModeLink.href = `${basePageUrl.pathname}${basePageUrl.search}${basePageUrl.hash}`;
    } else {
      const coachUrl = new URL(basePageUrl.href);
      coachUrl.searchParams.set("mode", "coach");
      elements.coachModeLink.textContent = "Coach Controller";
      elements.coachModeLink.href = `${coachUrl.pathname}${coachUrl.search}${coachUrl.hash}`;
    }
  }

  document.querySelectorAll(".sport-switcher-link").forEach((link) => {
    const targetUrl = new URL(link.href, window.location.href);
    targetUrl.searchParams.set("session", sessionCode);

    if (coachControllerMode) targetUrl.searchParams.set("mode", "coach");
    else targetUrl.searchParams.delete("mode");

    link.href = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  });

  if (!coachControllerMode) return;

  document.body.classList.add("coach-controller-mode");
  elements.coachModeNotice?.classList.remove("is-hidden");
}

function configurePrivacyNotice() {
  let dismissed = false;

  try {
    dismissed = localStorage.getItem("replay-assistant-beta-privacy-dismissed") === "yes";
  } catch (error) {
    console.warn("Unable to read privacy notice preference.", error);
  }

  if (dismissed) elements.privacyNotice?.classList.add("is-hidden");

  elements.dismissPrivacyNotice?.addEventListener("click", () => {
    elements.privacyNotice?.classList.add("is-hidden");

    try {
      localStorage.setItem("replay-assistant-beta-privacy-dismissed", "yes");
    } catch (error) {
      console.warn("Unable to save privacy notice preference.", error);
    }
  });
}

function configureFeedbackLinks(sessionCode) {
  const sport = document.body.className
    .split(/\s+/)
    .find((className) => /^(sport-gymnastics|sport-baseball|sport-basketball|sport-soccer)$/.test(className))
    ?.replace("sport-", "") || "Not specified";

  for (const link of elements.feedbackLinks) {
    const url = new URL(link.href, window.location.href);
    url.searchParams.set("sport", sport);
    url.searchParams.set("session", sessionCode);
    link.href = url.href;
  }
}
