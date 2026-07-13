const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const express = require("express");
const QRCode = require("qrcode");
const { Server } = require("socket.io");

const APP_VERSION = "0.6.0";
const app = express();
const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");
const keyPath = path.join(__dirname, "certificates", "key.pem");
const certPath = path.join(__dirname, "certificates", "cert.pem");
const SESSION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SESSION_LENGTH = 6;
const MAX_CAMERAS_PER_SESSION = 8;
const SESSION_RETENTION_MS = 12 * 60 * 60 * 1000;

app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));
app.use(express.static(publicDir));

const sessions = new Map();
const feedbackRateLimits = new Map();

function normalizeSessionCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

function isValidSessionCode(value) {
  return /^[A-Z0-9]{4,10}$/.test(normalizeSessionCode(value));
}

function createSessionCode() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = "";
    const bytes = crypto.randomBytes(SESSION_LENGTH);

    for (const byte of bytes) {
      code += SESSION_ALPHABET[byte % SESSION_ALPHABET.length];
    }

    if (!sessions.has(code)) return code;
  }

  throw new Error("Unable to create a unique session code.");
}

function createSession(code) {
  const now = Date.now();
  const session = {
    code,
    createdAt: now,
    lastActivity: now,
    nextCameraNumber: 2,
    controllers: new Set(),
    camerasByKey: new Map(),
    camerasById: new Map()
  };

  sessions.set(code, session);
  return session;
}

function getOrCreateSession(rawCode) {
  const code = normalizeSessionCode(rawCode);
  if (!isValidSessionCode(code)) return null;

  const session = sessions.get(code) || createSession(code);
  session.lastActivity = Date.now();
  return session;
}

function controllerRoom(code) {
  return `session:${code}:controllers`;
}

function getDefaultCameraName(cameraId) {
  return `Camera ${cameraId.split("-")[1] || ""}`.trim();
}

function normalizeCameraKey(value) {
  const key = String(value || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  return key.length >= 8 ? key : null;
}

function splitUrls(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildIceServers() {
  const configuredStunUrls = splitUrls(process.env.STUN_URLS);
  const iceServers = [
    {
      urls: configuredStunUrls.length
        ? configuredStunUrls
        : ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]
    }
  ];

  const turnUrls = splitUrls(process.env.TURN_URLS);
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;

  if (turnUrls.length && username && credential) {
    iceServers.push({ urls: turnUrls, username, credential });
  }

  return iceServers;
}

function publicOrigin(req) {
  return `${req.protocol}://${req.get("host")}`;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Replay Assistant",
    version: APP_VERSION,
    activeSessions: sessions.size,
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.get("/api/config", (_req, res) => {
  res.json({
    version: APP_VERSION,
    beta: true,
    iceServers: buildIceServers(),
    turnConfigured: Boolean(
      splitUrls(process.env.TURN_URLS).length &&
      process.env.TURN_USERNAME &&
      process.env.TURN_CREDENTIAL
    )
  });
});

app.post("/api/sessions", (_req, res) => {
  const session = createSession(createSessionCode());
  res.status(201).json({ sessionCode: session.code });
});

app.get("/api/sessions/:sessionCode", (req, res) => {
  const code = normalizeSessionCode(req.params.sessionCode);
  if (!isValidSessionCode(code)) {
    res.status(400).json({ error: "Invalid session code." });
    return;
  }

  const session = sessions.get(code);
  res.json({
    sessionCode: code,
    active: Boolean(session),
    activeCameras: session
      ? [...session.camerasById.values()].filter((camera) => camera.active).length
      : 0
  });
});

app.get("/api/sessions/:sessionCode/qr.png", async (req, res) => {
  const code = normalizeSessionCode(req.params.sessionCode);
  if (!isValidSessionCode(code)) {
    res.status(400).send("Invalid session code.");
    return;
  }

  const cameraUrl = new URL("/camera.html", publicOrigin(req));
  cameraUrl.searchParams.set("session", code);

  try {
    const png = await QRCode.toBuffer(cameraUrl.href, {
      type: "png",
      width: 420,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#10233c",
        light: "#ffffff"
      }
    });

    res.type("png");
    res.set("Cache-Control", "private, max-age=300");
    res.send(png);
  } catch (error) {
    console.error("Unable to generate camera QR code.", error);
    res.status(500).send("Unable to generate QR code.");
  }
});

app.post("/api/feedback", (req, res) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const prior = feedbackRateLimits.get(ip) || [];
  const recent = prior.filter((time) => now - time < 60 * 60 * 1000);

  if (recent.length >= 5) {
    res.status(429).json({ error: "Too many feedback submissions. Please try again later." });
    return;
  }

  const sport = String(req.body?.sport || "Not specified").slice(0, 40);
  const rating = String(req.body?.rating || "Not specified").slice(0, 20);
  const comments = String(req.body?.comments || "").trim().slice(0, 4000);
  const contact = String(req.body?.contact || "").trim().slice(0, 200);
  const sessionCode = normalizeSessionCode(req.body?.sessionCode || "");

  if (comments.length < 3) {
    res.status(400).json({ error: "Please include a little more detail." });
    return;
  }

  recent.push(now);
  feedbackRateLimits.set(ip, recent);

  console.log("[REPLAY_ASSISTANT_BETA_FEEDBACK]", JSON.stringify({
    receivedAt: new Date().toISOString(),
    sport,
    rating,
    comments,
    contact,
    sessionCode: sessionCode || undefined
  }));

  res.status(201).json({ ok: true });
});

let server;
let protocol;

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  server = https.createServer(
    {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    },
    app
  );
  protocol = "https";
} else {
  server = http.createServer(app);
  protocol = "http";
  console.warn("HTTPS certificates were not found. Render will provide HTTPS in production.");
}

const io = new Server(server, {
  pingInterval: 20000,
  pingTimeout: 25000,
  maxHttpBufferSize: 1e6
});

function emitSessionError(socket, message) {
  socket.emit("session-error", { message });
}

function announceCamera(session, camera) {
  if (!camera.active || !camera.socketId) return;

  io.to(controllerRoom(session.code)).emit("camera-available", {
    cameraId: camera.id,
    defaultName: camera.name,
    sessionCode: session.code
  });
}

function getSocketSession(socket, expectedRole) {
  const sessionCode = socket.data.sessionCode;
  const session = sessionCode ? sessions.get(sessionCode) : null;

  if (!session) return null;
  if (expectedRole && socket.data.role !== expectedRole) return null;

  session.lastActivity = Date.now();
  return session;
}

io.on("connection", (socket) => {
  socket.on("join-controller", ({ sessionCode } = {}) => {
    const session = getOrCreateSession(sessionCode);
    if (!session) {
      emitSessionError(socket, "A valid private session code is required.");
      return;
    }

    if (socket.data.sessionCode && socket.data.sessionCode !== session.code) {
      socket.leave(controllerRoom(socket.data.sessionCode));
    }

    socket.data.role = "controller";
    socket.data.sessionCode = session.code;
    session.controllers.add(socket.id);
    socket.join(controllerRoom(session.code));

    socket.emit("session-joined", {
      sessionCode: session.code,
      role: "controller"
    });

    for (const camera of session.camerasById.values()) {
      announceCamera(session, camera);
    }
  });

  socket.on("join-camera", ({ sessionCode, cameraKey } = {}) => {
    const session = getOrCreateSession(sessionCode);
    const normalizedKey = normalizeCameraKey(cameraKey);

    if (!session || !normalizedKey) {
      emitSessionError(socket, "A valid session code and camera identity are required.");
      return;
    }

    let camera = session.camerasByKey.get(normalizedKey);

    if (!camera) {
      if (session.camerasById.size >= MAX_CAMERAS_PER_SESSION) {
        emitSessionError(socket, `This session already has ${MAX_CAMERAS_PER_SESSION} cameras.`);
        return;
      }

      const cameraId = `camera-${session.nextCameraNumber++}`;
      camera = {
        id: cameraId,
        key: normalizedKey,
        name: getDefaultCameraName(cameraId),
        socketId: socket.id,
        active: true,
        lastSeen: Date.now()
      };
      session.camerasByKey.set(normalizedKey, camera);
      session.camerasById.set(cameraId, camera);
    } else {
      const oldSocketId = camera.socketId;
      if (oldSocketId && oldSocketId !== socket.id) {
        io.to(oldSocketId).emit("camera-replaced");
      }

      camera.socketId = socket.id;
      camera.active = true;
      camera.lastSeen = Date.now();
    }

    socket.data.role = "camera";
    socket.data.sessionCode = session.code;
    socket.data.cameraId = camera.id;
    socket.data.cameraKey = camera.key;

    socket.emit("camera-assigned", {
      cameraId: camera.id,
      defaultName: camera.name,
      sessionCode: session.code
    });

    announceCamera(session, camera);
  });

  socket.on("camera-stopped", ({ cameraId } = {}) => {
    const session = getSocketSession(socket, "camera");
    if (!session || socket.data.cameraId !== cameraId) return;

    const camera = session.camerasById.get(cameraId);
    if (!camera || camera.socketId !== socket.id) return;

    camera.active = false;
    camera.lastSeen = Date.now();
    io.to(controllerRoom(session.code)).emit("camera-stopped", { cameraId });
  });

  socket.on("camera-restarted", ({ cameraId } = {}) => {
    const session = getSocketSession(socket, "camera");
    if (!session || socket.data.cameraId !== cameraId) return;

    const camera = session.camerasById.get(cameraId);
    if (!camera || camera.socketId !== socket.id) return;

    camera.socketId = socket.id;
    camera.active = true;
    camera.lastSeen = Date.now();
    announceCamera(session, camera);
  });

  socket.on("controller-offer", ({ cameraId, offer } = {}) => {
    const session = getSocketSession(socket, "controller");
    if (!session || !offer) return;

    const camera = session.camerasById.get(cameraId);
    if (!camera?.active || !camera.socketId) return;

    io.to(camera.socketId).emit("offer", {
      cameraId,
      controllerId: socket.id,
      offer
    });
  });

  socket.on("camera-answer", ({ cameraId, controllerId, answer } = {}) => {
    const session = getSocketSession(socket, "camera");
    if (!session || socket.data.cameraId !== cameraId || !answer) return;
    const camera = session.camerasById.get(cameraId);
    if (!camera || camera.socketId !== socket.id) return;
    if (!session.controllers.has(controllerId)) return;

    io.to(controllerId).emit("answer", { cameraId, answer });
  });

  socket.on("controller-ice-candidate", ({ cameraId, candidate } = {}) => {
    const session = getSocketSession(socket, "controller");
    if (!session || !candidate) return;

    const camera = session.camerasById.get(cameraId);
    if (!camera?.active || !camera.socketId) return;

    io.to(camera.socketId).emit("ice-candidate", {
      cameraId,
      controllerId: socket.id,
      candidate
    });
  });

  socket.on("camera-ice-candidate", ({ cameraId, controllerId, candidate } = {}) => {
    const session = getSocketSession(socket, "camera");
    if (!session || socket.data.cameraId !== cameraId || !candidate) return;
    const camera = session.camerasById.get(cameraId);
    if (!camera || camera.socketId !== socket.id) return;
    if (!session.controllers.has(controllerId)) return;

    io.to(controllerId).emit("ice-candidate", { cameraId, candidate });
  });

  socket.on("disconnect", () => {
    const session = socket.data.sessionCode
      ? sessions.get(socket.data.sessionCode)
      : null;

    if (!session) return;

    session.lastActivity = Date.now();

    if (socket.data.role === "controller") {
      session.controllers.delete(socket.id);

      for (const camera of session.camerasById.values()) {
        if (camera.socketId) {
          io.to(camera.socketId).emit("controller-disconnected", {
            controllerId: socket.id
          });
        }
      }
    }

    if (socket.data.role === "camera" && socket.data.cameraId) {
      const camera = session.camerasById.get(socket.data.cameraId);

      if (camera && camera.socketId === socket.id) {
        camera.socketId = null;
        camera.active = false;
        camera.lastSeen = Date.now();
        io.to(controllerRoom(session.code)).emit("camera-disconnected", {
          cameraId: camera.id
        });
      }
    }
  });
});

setInterval(() => {
  const now = Date.now();

  for (const [code, session] of sessions) {
    const hasActiveCamera = [...session.camerasById.values()].some(
      (camera) => camera.active && camera.socketId
    );

    if (
      session.controllers.size === 0 &&
      !hasActiveCamera &&
      now - session.lastActivity > SESSION_RETENTION_MS
    ) {
      sessions.delete(code);
    }
  }

  for (const [ip, times] of feedbackRateLimits) {
    const recent = times.filter((time) => now - time < 60 * 60 * 1000);
    if (recent.length) feedbackRateLimits.set(ip, recent);
    else feedbackRateLimits.delete(ip);
  }
}, 30 * 60 * 1000).unref();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Replay Assistant v${APP_VERSION} running at ${protocol}://localhost:${PORT}`);
  console.log(`Health check: ${protocol}://localhost:${PORT}/api/health`);
});
