export const state = {
  recorder: null,
  recorderChunks: [],
  lastAttemptBlob: null,
  lastAttemptMetadata: null,
  recordingTimer: null,
  recordingStopFallback: null,
  recordingFinalized: false,
  recordingStream: null,
  canvasAnimationFrame: null,
  selectedMimeType: ""
};
