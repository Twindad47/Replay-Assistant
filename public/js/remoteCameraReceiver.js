import { getRtcConfig } from "./webrtcConfig.js";

export function setupRemoteCameraReceiver(
  socket,
  cameraManager,
  {
    sessionCode,
    onSocketStatus = () => {},
    onSessionError = () => {}
  } = {}
) {
  const retryTimers = new Map();
  const retryAttempts = new Map();

  const joinController = () => {
    if (!sessionCode) return;
    onSocketStatus("connected");
    socket.emit("join-controller", { sessionCode });
  };

  socket.on("connect", joinController);

  if (socket.connected) {
    joinController();
  }

  socket.on("disconnect", () => {
    onSocketStatus("reconnecting");

    for (const camera of cameraManager.getAll()) {
      if (camera.type !== "remote") continue;
      camera.peerConnection?.close();
      camera.peerConnection = null;
      camera.pendingIceCandidates = [];
      cameraManager.clearStream(camera.id, {
        status: "connecting",
        stopTracks: true
      });
    }
  });

  socket.io.on("reconnect_attempt", () => {
    onSocketStatus("reconnecting");
  });

  socket.io.on("reconnect_failed", () => {
    onSocketStatus("failed");
  });

  socket.on("session-joined", () => {
    onSocketStatus("connected");
  });

  socket.on("session-error", ({ message } = {}) => {
    onSessionError(message || "Unable to join the private session.");
  });

  socket.on("camera-available", async ({ cameraId, defaultName }) => {
    clearRetry(cameraId);

    if (!cameraManager.getCamera(cameraId)) {
      cameraManager.addCamera({
        id: cameraId,
        name: defaultName,
        type: "remote",
        status: "connecting"
      });
    } else {
      cameraManager.updateCamera(cameraId, {
        name: cameraManager.getCamera(cameraId).name || defaultName,
        status: "connecting"
      });
    }

    try {
      await connectRemoteCamera(socket, cameraManager, cameraId, scheduleRetry);
      retryAttempts.set(cameraId, 0);
    } catch (error) {
      console.error("Unable to connect remote camera.", error);
      cameraManager.updateCamera(cameraId, { status: "failed" });
      scheduleRetry(cameraId);
    }
  });

  socket.on("answer", async ({ cameraId, answer }) => {
    const camera = cameraManager.getCamera(cameraId);
    if (!camera?.peerConnection || !answer) return;

    try {
      await camera.peerConnection.setRemoteDescription(answer);

      for (const candidate of camera.pendingIceCandidates) {
        await camera.peerConnection.addIceCandidate(candidate);
      }

      camera.pendingIceCandidates = [];
    } catch (error) {
      console.error("Unable to apply camera answer.", error);
      scheduleRetry(cameraId);
    }
  });

  socket.on("ice-candidate", async ({ cameraId, candidate }) => {
    const camera = cameraManager.getCamera(cameraId);
    if (!camera?.peerConnection || !candidate) return;

    try {
      if (camera.peerConnection.remoteDescription) {
        await camera.peerConnection.addIceCandidate(candidate);
      } else {
        camera.pendingIceCandidates.push(candidate);
      }
    } catch (error) {
      console.warn("Unable to add camera ICE candidate.", error);
    }
  });

  socket.on("camera-stopped", ({ cameraId }) => {
    clearRetry(cameraId);
    const camera = cameraManager.getCamera(cameraId);
    if (!camera) return;

    camera.peerConnection?.close();
    camera.peerConnection = null;
    camera.pendingIceCandidates = [];
    cameraManager.clearStream(cameraId, { status: "offline" });
  });

  socket.on("camera-disconnected", ({ cameraId }) => {
    clearRetry(cameraId);
    const camera = cameraManager.getCamera(cameraId);
    if (!camera) return;

    camera.peerConnection?.close();
    camera.peerConnection = null;
    camera.pendingIceCandidates = [];
    cameraManager.clearStream(cameraId, {
      status: "connecting",
      stopTracks: true
    });
  });

  function clearRetry(cameraId) {
    const timer = retryTimers.get(cameraId);
    if (timer) clearTimeout(timer);
    retryTimers.delete(cameraId);
  }

  function scheduleRetry(cameraId) {
    if (!socket.connected || retryTimers.has(cameraId)) return;
    const camera = cameraManager.getCamera(cameraId);
    if (!camera || camera.type !== "remote") return;

    const attempt = (retryAttempts.get(cameraId) || 0) + 1;
    retryAttempts.set(cameraId, attempt);
    const delay = Math.min(1000 * (2 ** Math.min(attempt - 1, 4)), 15000);

    cameraManager.updateCamera(cameraId, { status: "connecting" });

    retryTimers.set(cameraId, setTimeout(async () => {
      retryTimers.delete(cameraId);

      try {
        await connectRemoteCamera(socket, cameraManager, cameraId, scheduleRetry);
        retryAttempts.set(cameraId, 0);
      } catch (error) {
        console.warn(`Camera ${cameraId} reconnect attempt failed.`, error);
        scheduleRetry(cameraId);
      }
    }, delay));
  }
}

async function connectRemoteCamera(socket, cameraManager, cameraId, scheduleRetry) {
  const camera = cameraManager.getCamera(cameraId);
  if (!camera) return;

  camera.peerConnection?.close();
  camera.pendingIceCandidates = [];

  const peer = new RTCPeerConnection(await getRtcConfig());
  camera.peerConnection = peer;

  peer.addTransceiver("video", { direction: "recvonly" });

  peer.addEventListener("track", (event) => {
    const stream = event.streams[0] || new MediaStream([event.track]);
    cameraManager.setStream(cameraId, stream);
  });

  peer.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      socket.emit("controller-ice-candidate", {
        cameraId,
        candidate: event.candidate
      });
    }
  });

  peer.addEventListener("connectionstatechange", () => {
    if (camera.peerConnection !== peer) return;

    if (peer.connectionState === "connected") {
      cameraManager.updateCamera(cameraId, { status: "connected" });
    } else if (peer.connectionState === "disconnected") {
      cameraManager.updateCamera(cameraId, { status: "connecting" });
      scheduleRetry(cameraId);
    } else if (peer.connectionState === "failed") {
      cameraManager.updateCamera(cameraId, { status: "failed" });
      scheduleRetry(cameraId);
    }
  });

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);

  socket.emit("controller-offer", {
    cameraId,
    offer: peer.localDescription
  });
}
