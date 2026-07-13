export class CameraManager {
  constructor(gridElement, { onChange } = {}) {
    this.gridElement = gridElement;
    this.cameras = new Map();
    this.onChange = typeof onChange === "function" ? onChange : null;
  }

  notifyChange() {
    this.onChange?.(this);
  }

  addCamera({ id, name, type, status = "offline" }) {
    if (this.cameras.has(id)) return this.cameras.get(id);

    const camera = {
      id,
      name,
      type,
      status,
      stream: null,
      recordEnabled: true,
      peerConnection: null,
      pendingIceCandidates: []
    };

    this.cameras.set(id, camera);
    this.renderCamera(camera);
    this.updateCameraCard(camera);
    this.notifyChange();
    return camera;
  }

  removeCamera(id) {
    const camera = this.cameras.get(id);
    if (!camera) return;

    camera.peerConnection?.close();
    camera.stream?.getTracks().forEach((track) => track.stop());
    camera.cardElement?.remove();
    this.cameras.delete(id);
    this.notifyChange();
  }

  getCamera(id) {
    return this.cameras.get(id) || null;
  }

  getAll() {
    return [...this.cameras.values()];
  }

  getConnectedRecordable() {
    return this.getAll().filter(
      (camera) =>
        camera.recordEnabled &&
        camera.status === "connected" &&
        camera.stream &&
        camera.videoElement
    );
  }

  updateCamera(id, updates) {
    const camera = this.getCamera(id);
    if (!camera) return;

    Object.assign(camera, updates);
    this.updateCameraCard(camera);
    this.notifyChange();
  }

  setStream(id, stream) {
    const camera = this.getCamera(id);
    if (!camera) return;

    if (camera.stream && camera.stream !== stream) {
      camera.stream.getTracks().forEach((track) => track.stop());
    }

    camera.stream = stream;
    camera.status = "connected";
    camera.videoElement.srcObject = stream;
    camera.videoElement.play().catch(console.warn);
    this.updateCameraCard(camera);
    this.notifyChange();
  }

  clearStream(id, { status = "offline", stopTracks = true } = {}) {
    const camera = this.getCamera(id);
    if (!camera) return;

    if (stopTracks && camera.stream) {
      camera.stream.getTracks().forEach((track) => track.stop());
    }

    camera.stream = null;
    camera.status = status;

    if (camera.videoElement) {
      camera.videoElement.pause();
      camera.videoElement.srcObject = null;
    }

    this.updateCameraCard(camera);
    this.notifyChange();
  }

  renderCamera(camera) {
    const card = document.createElement("article");
    card.className = "camera-card";

    card.innerHTML = `
      <div class="camera-card-heading">
        <input class="camera-name-input" value="${camera.name}">
        <span class="camera-badge">Offline</span>
      </div>
      <div class="video-wrapper">
        <video autoplay muted playsinline></video>
        <div class="video-placeholder">Waiting for camera…</div>
      </div>
    `;

    camera.cardElement = card;
    camera.videoElement = card.querySelector("video");
    camera.nameInput = card.querySelector(".camera-name-input");
    camera.badgeElement = card.querySelector(".camera-badge");
    camera.placeholderElement = card.querySelector(".video-placeholder");

    camera.nameInput.addEventListener("change", () => {
      camera.name = camera.nameInput.value.trim() || camera.name;
      camera.nameInput.value = camera.name;
      this.notifyChange();
    });

    this.gridElement.appendChild(card);
  }

  updateCameraCard(camera) {
    camera.nameInput.value = camera.name;
    camera.badgeElement.className = "camera-badge";

    if (camera.status === "connected") {
      camera.badgeElement.textContent = "Connected";
      camera.badgeElement.classList.add("is-connected");
      camera.placeholderElement.classList.add("is-hidden");
    } else if (camera.status === "connecting") {
      camera.badgeElement.textContent = "Connecting";
      camera.badgeElement.classList.add("is-connecting");
      camera.placeholderElement.textContent = "Connecting…";
      camera.placeholderElement.classList.remove("is-hidden");
    } else if (camera.status === "failed") {
      camera.badgeElement.textContent = "Connection failed";
      camera.badgeElement.classList.add("is-failed");
      camera.placeholderElement.textContent = "Connection failed";
      camera.placeholderElement.classList.remove("is-hidden");
    } else {
      camera.badgeElement.textContent = "Offline";
      camera.placeholderElement.textContent =
        camera.type === "local" ? "Start Camera 1" : "Camera stopped";
      camera.placeholderElement.classList.remove("is-hidden");
    }
  }
}
