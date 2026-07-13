import { state } from "./state.js";
import { elements, setText } from "./ui.js";
import { saveReplay, getReplay, getAllReplays, deleteReplay } from "./replayStore.js";
import { openReplayBlob } from "./replay.js";

let editingReplayId = null;
let thumbnailEditingReplayId = null;
let thumbnailPreviewUrl = null;
let thumbnailSeekTimer = null;

export function setupGallery() {
  elements.saveReplayButton.addEventListener("click", openSaveDialog);
  elements.cancelSaveReplay.addEventListener("click", () => elements.saveReplayDialog.close());
  elements.saveReplayForm.addEventListener("submit", handleSaveReplay);
  elements.cancelRenameReplay.addEventListener("click", () => elements.renameReplayDialog.close());
  elements.renameReplayForm.addEventListener("submit", handleRenameReplay);
  elements.cancelThumbnail.addEventListener("click", closeThumbnailDialog);
  elements.thumbnailForm.addEventListener("submit", handleSaveThumbnail);
  elements.thumbnailFrameRange.addEventListener("input", handleThumbnailFrameInput);
  elements.thumbnailDialog.addEventListener("close", cleanupThumbnailDialog);
  elements.persistStorageButton.addEventListener("click", requestPersistentStorage);
  refreshGallery();
  updateStorageStatus();
}

function openSaveDialog() {
  if (!state.lastAttemptBlob || !state.lastAttemptMetadata) return;
  const now = new Date();
  elements.replayName.value = `Replay ${now.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}`;
  elements.gymnastName.value = localStorage.getItem("lastAthleteName") || localStorage.getItem("lastGymnastName") || "";
  elements.replayNotes.value = "";
  elements.saveReplayDialog.showModal();
  elements.replayName.focus();
}

async function handleSaveReplay(event) {
  event.preventDefault();
  const name = elements.replayName.value.trim();
  const gymnast = elements.gymnastName.value.trim();
  const notes = elements.replayNotes.value.trim();
  if (!name || !state.lastAttemptBlob || !state.lastAttemptMetadata) return;

  const m = state.lastAttemptMetadata;
  const thumbnailDataUrl = await generateReplayThumbnail(state.lastAttemptBlob);

  await saveReplay({
    id: crypto.randomUUID(), name, gymnast, notes,
    createdAt: m.createdAt, duration: m.duration,
    replaySpeed: m.replaySpeed, cameraNames: m.cameraNames,
    mimeType: state.lastAttemptBlob.type, size: state.lastAttemptBlob.size,
    thumbnailDataUrl,
    videoBlob: state.lastAttemptBlob
  });

  localStorage.setItem("lastAthleteName", gymnast);
  localStorage.setItem("lastGymnastName", gymnast);
  elements.saveReplayDialog.close();
  elements.saveReplayButton.disabled = true;
  setText(elements.appStatus, `"${name}" was saved.`);
  await refreshGallery();
  await updateStorageStatus();
}

async function refreshGallery() {
  const records = await getAllReplays();

  for (const record of records) {
    if (!record.thumbnailDataUrl && record.videoBlob) {
      try {
        record.thumbnailDataUrl = await generateReplayThumbnail(record.videoBlob);
        await saveReplay(record);
      } catch (error) {
        console.warn("Unable to generate replay thumbnail", error);
      }
    }
  }

  records.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  elements.replayGallery.innerHTML = "";
  elements.emptyGallery.classList.toggle("is-hidden", records.length > 0);
  for (const record of records) elements.replayGallery.appendChild(createCard(record));
}

function createCard(record) {
  const card = document.createElement("article");
  card.className = "replay-card";
  const date = new Date(record.createdAt);
  const cameras = record.cameraNames?.join(", ") || "Camera information unavailable";
  const thumbnailMarkup = record.thumbnailDataUrl
    ? `<img src="${record.thumbnailDataUrl}" alt="Thumbnail preview for ${esc(record.name)}" class="replay-thumbnail-image">`
    : `<div class="replay-thumbnail-placeholder">Preview unavailable</div>`;

  card.innerHTML = `<button type="button" class="replay-thumbnail-button" aria-label="Play ${esc(record.name)}">
      ${thumbnailMarkup}
      <span class="replay-thumbnail-play" aria-hidden="true">▶</span>
    </button>
    <h3>${esc(record.name)}</h3>
    <p class="replay-meta">${esc(record.gymnast || "Athlete not named")}</p>
    <p class="replay-meta">${esc(date.toLocaleString())}</p>
    <p class="replay-meta">${record.duration || "?"} sec • ${esc(cameras)}</p>
    <p class="replay-meta">${formatBytes(record.size || record.videoBlob?.size || 0)}</p>
    <div class="replay-notes">${esc(record.notes || "No notes")}</div>
    <div class="replay-card-actions">
      <button class="watch-action">Watch</button>
      <button class="rename-action">Rename</button>
      <a class="download-action" title="Download the original normal-speed clip">Download 1×</a>
      <button class="delete-action">Delete</button>
      <button class="thumbnail-action">Choose Frame</button>
    </div>`;

  const watchReplay = async () => {
    const saved = await getReplay(record.id);
    openReplayBlob(saved.videoBlob, saved.replaySpeed || .5, saved.name);
  };

  card.querySelector('.replay-thumbnail-button').onclick = watchReplay;
  card.querySelector('.watch-action').onclick = watchReplay;
  card.querySelector('.rename-action').onclick = () => {
    editingReplayId = record.id;
    elements.renameReplayName.value = record.name;
    elements.renameGymnastName.value = record.gymnast || "";
    elements.renameReplayNotes.value = record.notes || "";
    elements.renameReplayDialog.showModal();
  };
  const link = card.querySelector('.download-action');
  const downloadUrl = URL.createObjectURL(record.videoBlob);
  link.href = downloadUrl;
  link.download = `${safeFilename(record.name)}.webm`;
  link.onclick = () => setTimeout(()=>URL.revokeObjectURL(downloadUrl),3000);
  card.querySelector('.delete-action').onclick = async () => {
    if (!confirm(`Delete "${record.name}"?`)) return;
    await deleteReplay(record.id);
    await refreshGallery();
    await updateStorageStatus();
  };
  card.querySelector('.thumbnail-action').onclick = () => openThumbnailDialog(record.id);
  return card;
}

async function generateReplayThumbnail(blob) {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await waitForEvent(video, "loadedmetadata");

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const targetTime = duration > 0
      ? Math.max(0, Math.min(duration / 2, duration - 0.1))
      : 0;

    if (targetTime > 0) {
      video.currentTime = targetTime;
      await waitForEvent(video, "seeked");
    } else {
      await waitForEvent(video, "loadeddata");
    }

    return captureVideoFrame(video);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function openThumbnailDialog(replayId) {
  const record = await getReplay(replayId);
  if (!record?.videoBlob) return;

  cleanupThumbnailDialog();
  thumbnailEditingReplayId = replayId;
  thumbnailPreviewUrl = URL.createObjectURL(record.videoBlob);

  elements.thumbnailVideo.src = thumbnailPreviewUrl;
  elements.thumbnailVideo.load();
  elements.thumbnailDialog.showModal();

  try {
    await waitForEvent(elements.thumbnailVideo, "loadedmetadata");

    if (thumbnailEditingReplayId !== replayId) return;

    const duration = Number.isFinite(elements.thumbnailVideo.duration)
      ? elements.thumbnailVideo.duration
      : Number(record.duration) || 0;
    const selectedTime = clamp(
      Number.isFinite(record.thumbnailTime) ? record.thumbnailTime : duration / 2,
      0,
      Math.max(0, duration - 0.05)
    );

    elements.thumbnailFrameRange.min = "0";
    elements.thumbnailFrameRange.max = String(Math.max(duration, 0.1));
    elements.thumbnailFrameRange.step = "0.05";
    elements.thumbnailFrameRange.value = String(selectedTime);
    updateThumbnailTimeLabel(selectedTime, duration);

    if (selectedTime > 0) {
      elements.thumbnailVideo.currentTime = selectedTime;
      await waitForEvent(elements.thumbnailVideo, "seeked");
    } else if (elements.thumbnailVideo.readyState < 2) {
      await waitForEvent(elements.thumbnailVideo, "loadeddata");
    }
  } catch (error) {
    console.warn("Unable to open thumbnail picker", error);
    setText(elements.appStatus, "Unable to open the thumbnail picker for this replay.");
    closeThumbnailDialog();
  }
}

function handleThumbnailFrameInput() {
  const targetTime = Number(elements.thumbnailFrameRange.value);
  const duration = Number(elements.thumbnailVideo.duration) || 0;
  updateThumbnailTimeLabel(targetTime, duration);

  clearTimeout(thumbnailSeekTimer);
  thumbnailSeekTimer = setTimeout(() => {
    if (Number.isFinite(targetTime)) {
      elements.thumbnailVideo.currentTime = targetTime;
    }
  }, 35);
}

async function handleSaveThumbnail(event) {
  event.preventDefault();
  if (!thumbnailEditingReplayId) return;

  const record = await getReplay(thumbnailEditingReplayId);
  if (!record) return;

  const targetTime = Number(elements.thumbnailFrameRange.value) || 0;
  elements.saveThumbnail.disabled = true;
  elements.saveThumbnail.textContent = "Saving…";

  try {
    if (Math.abs(elements.thumbnailVideo.currentTime - targetTime) > 0.03) {
      elements.thumbnailVideo.currentTime = targetTime;
      await waitForEvent(elements.thumbnailVideo, "seeked");
    }

    record.thumbnailDataUrl = captureVideoFrame(elements.thumbnailVideo);
    record.thumbnailTime = targetTime;
    await saveReplay(record);

    elements.thumbnailDialog.close();
    setText(elements.appStatus, `Thumbnail updated for "${record.name}".`);
    await refreshGallery();
  } catch (error) {
    console.warn("Unable to save replay thumbnail", error);
    setText(elements.appStatus, "Unable to save that thumbnail frame.");
  } finally {
    elements.saveThumbnail.disabled = false;
    elements.saveThumbnail.textContent = "Use This Frame";
  }
}

function closeThumbnailDialog() {
  if (elements.thumbnailDialog.open) elements.thumbnailDialog.close();
  else cleanupThumbnailDialog();
}

function cleanupThumbnailDialog() {
  clearTimeout(thumbnailSeekTimer);
  thumbnailSeekTimer = null;
  thumbnailEditingReplayId = null;

  elements.thumbnailVideo.pause();
  elements.thumbnailVideo.removeAttribute("src");
  elements.thumbnailVideo.load();
  elements.thumbnailFrameRange.value = "0";
  elements.thumbnailTimeLabel.textContent = "0:00 / 0:00";

  if (thumbnailPreviewUrl) {
    URL.revokeObjectURL(thumbnailPreviewUrl);
    thumbnailPreviewUrl = null;
  }
}

function captureVideoFrame(video) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const canvasWidth = 320;
  const canvasHeight = 180;
  const videoWidth = video.videoWidth || 1280;
  const videoHeight = video.videoHeight || 720;
  const scale = Math.min(canvasWidth / videoWidth, canvasHeight / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;
  const drawX = (canvasWidth - drawWidth) / 2;
  const drawY = (canvasHeight - drawHeight) / 2;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  context.fillStyle = "#000";
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.drawImage(video, drawX, drawY, drawWidth, drawHeight);

  return canvas.toDataURL("image/jpeg", 0.82);
}

function updateThumbnailTimeLabel(current, duration) {
  elements.thumbnailTimeLabel.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function waitForEvent(target, eventName) {
  if (eventName === "loadedmetadata" && target.readyState >= 1) {
    return Promise.resolve();
  }

  if (eventName === "loadeddata" && target.readyState >= 2) {
    return Promise.resolve();
  }

  if (eventName === "seeked" && !target.seeking && target.readyState >= 2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(eventName, onSuccess);
      target.removeEventListener("error", onError);
    };

    const onSuccess = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error(`Video ${eventName} failed.`));
    };

    target.addEventListener(eventName, onSuccess, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

async function handleRenameReplay(event) {
  event.preventDefault();
  if (!editingReplayId) return;
  const record = await getReplay(editingReplayId);
  if (!record) return;
  record.name = elements.renameReplayName.value.trim() || record.name;
  record.gymnast = elements.renameGymnastName.value.trim();
  record.notes = elements.renameReplayNotes.value.trim();
  await saveReplay(record);
  editingReplayId = null;
  elements.renameReplayDialog.close();
  await refreshGallery();
}

async function updateStorageStatus() {
  if (!navigator.storage?.estimate) { elements.storageStatus.textContent="Storage estimate unavailable"; return; }
  const {usage=0, quota=0} = await navigator.storage.estimate();
  const percent = quota ? Math.round(usage/quota*100) : 0;
  elements.storageStatus.textContent = `Storage: ${formatBytes(usage)} of ${formatBytes(quota)} (${percent}%)`;
  if (navigator.storage.persisted && await navigator.storage.persisted()) {
    elements.persistStorageButton.textContent="Storage Protected";
    elements.persistStorageButton.disabled=true;
  }
}

async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  const granted = await navigator.storage.persist();
  setText(elements.appStatus, granted ? "Browser storage protection was granted." : "Storage protection was not granted. Download important clips as backups.");
  await updateStorageStatus();
}

function formatBytes(bytes) { if(!bytes)return "0 B"; const u=["B","KB","MB","GB"]; const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),u.length-1); return `${(bytes/Math.pow(1024,i)).toFixed(i?1:0)} ${u[i]}`; }
function safeFilename(v){return v.replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"-")||"replay"}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c])}
