export const elements = {
  startCameraButton: document.getElementById("startCameraButton"),
  startAttemptButton: document.getElementById("startAttemptButton"),
  replayButton: document.getElementById("replayButton"),
  saveReplayButton: document.getElementById("saveReplayButton"),
  recordingLength: document.getElementById("recordingLength"),
  countdown: document.getElementById("countdown"),
  appStatus: document.getElementById("appStatus"),
  recordingStatus: document.getElementById("recordingStatus"),
  cameraGrid: document.getElementById("cameraGrid"),
  recordingCanvas: document.getElementById("recordingCanvas"),
  countdownOverlay: document.getElementById("countdownOverlay"),
  countdownOverlayValue: document.getElementById("countdownOverlayValue"),
  saveReplayDialog: document.getElementById("saveReplayDialog"),
  saveReplayForm: document.getElementById("saveReplayForm"),
  replayName: document.getElementById("replayName"),
  gymnastName: document.getElementById("gymnastName"),
  replayNotes: document.getElementById("replayNotes"),
  cancelSaveReplay: document.getElementById("cancelSaveReplay"),
  renameReplayDialog: document.getElementById("renameReplayDialog"),
  renameReplayForm: document.getElementById("renameReplayForm"),
  renameReplayName: document.getElementById("renameReplayName"),
  renameGymnastName: document.getElementById("renameGymnastName"),
  renameReplayNotes: document.getElementById("renameReplayNotes"),
  cancelRenameReplay: document.getElementById("cancelRenameReplay"),
  thumbnailDialog: document.getElementById("thumbnailDialog"),
  thumbnailForm: document.getElementById("thumbnailForm"),
  thumbnailVideo: document.getElementById("thumbnailVideo"),
  thumbnailFrameRange: document.getElementById("thumbnailFrameRange"),
  thumbnailTimeLabel: document.getElementById("thumbnailTimeLabel"),
  cancelThumbnail: document.getElementById("cancelThumbnail"),
  saveThumbnail: document.getElementById("saveThumbnail"),
  replayGallery: document.getElementById("replayGallery"),
  emptyGallery: document.getElementById("emptyGallery"),
  storageStatus: document.getElementById("storageStatus"),
  persistStorageButton: document.getElementById("persistStorageButton"),
  coachModeNotice: document.getElementById("coachModeNotice"),
  coachCameraUrl: document.getElementById("coachCameraUrl"),
  copyCameraLinkButton: document.getElementById("copyCameraLinkButton"),
  copySessionCodeButton: document.getElementById("copySessionCodeButton"),
  newSessionButton: document.getElementById("newSessionButton"),
  sessionCodeDisplay: document.getElementById("sessionCodeDisplay"),
  sessionQrImage: document.getElementById("sessionQrImage"),
  socketStatus: document.getElementById("socketStatus"),
  privacyNotice: document.getElementById("privacyNotice"),
  dismissPrivacyNotice: document.getElementById("dismissPrivacyNotice"),
  coachModeLink: document.querySelector("[data-coach-mode-link]"),
  feedbackLinks: [...document.querySelectorAll("[data-feedback-link]")]
};

export function setText(element, text) {
  if (element) element.textContent = text;
}

export function setPill(element, text, className = "") {
  if (!element) return;
  element.textContent = text;
  element.className = "status-pill";
  if (className) element.classList.add(className);
}

export function setControlsLocked(locked) {
  if (elements.startAttemptButton) elements.startAttemptButton.disabled = locked;
  if (elements.recordingLength) elements.recordingLength.disabled = locked;
}
