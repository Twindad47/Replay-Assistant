# Changelog

## 0.6.1
- Restored the homepage to the approved professional visual design.
- Added the exact four-sport hero artwork with responsive interactive link areas.
- Restored the approved Choose Your Sport and How It Works presentation.
- Removed the extra homepage navigation that made the hosted beta look different from the approved design.
- Kept all v0.6.0 private-session, QR-code, coach-controller, privacy, feedback, and Render features.

## 0.6.0
- Added private session codes so cameras and controllers from different users cannot see each other.
- Added QR camera joining and copyable private camera links on every sport page.
- Added persistent camera identities so cameras return with the same camera number after reconnecting.
- Added clearer Socket.IO and WebRTC reconnection states with retry behavior.
- Added configurable TURN support through `TURN_URLS`, `TURN_USERNAME`, and `TURN_CREDENTIAL`.
- Added camera recording-consent confirmation and an online beta privacy notice.
- Added Privacy, Beta Terms, and Beta Feedback pages.
- Added Render health, configuration, session QR, and feedback endpoints.
- Added `render.yaml`, `DEPLOY_RENDER.md`, and an online beta test checklist.

## 0.5.2
- Added Coach Controller Mode so an iPad can control recording, replay, and saving without acting as a camera.
- Added a camera-link helper and copy button for connecting separate phones or tablets in Coach Controller Mode.
- Renamed Start Attempt to Record and Replay Last Attempt to Replay across all sport pages.
- Added a full-screen red countdown throughout recording.
- Added full-screen Processing and Replay Ready cues so athletes know exactly when the clip is available.

## 0.5.1
- Redesigned the home page to match the new polished mockup style.
- Added a richer top navigation bar with a stronger professional marketing look.
- Rebuilt the hero section with vertical sport panels for gymnastics, baseball, basketball, and soccer.
- Refined the sport selection cards and How It Works section to better match the updated visual direction.
- Added a more polished footer layout for the landing page.

## 0.5.0
- Added a new professional home page with a welcome hero section, sport selection cards, and a How It Works section.
- Added dedicated sport pages for gymnastics, baseball, basketball, and soccer.
- Added sport-specific branded header banners for each sport using the two-phone multi-angle Replay Assistant look.
- Added sport page navigation so users can quickly switch sports or return to the home page.
- Applied page-level color themes for gymnastics (blue), baseball (black), basketball (orange), and soccer (green).
- Updated replay window titles and gallery defaults to work better across all sports.

## 0.4.7
- Moved replay speed selection from the recording dashboard into the replay window.
- Added 0.25×, 0.50×, 0.75×, and 1× playback buttons that can be changed at any time while reviewing a replay.
- Added a Download Original (1×) action inside the replay window and clarified 1× downloads in the Saved Replays gallery.
- Added keyboard shortcuts 1–4 for the four playback speeds.

## 0.4.6
- Fixed the red Recording status remaining visible after an attempt ended.
- Fixed the remaining-seconds message remaining visible after recording stopped.
- Added a short Finishing replay status while the browser completes the video file.
- Added a guarded fallback so the interface reliably changes to Replay Ready even when a browser delays the MediaRecorder stop event.

## 0.4.5
- Made replay thumbnails smaller and constrained replay cards so multiple saved replays can appear side by side.
- Made each thumbnail clickable to open its replay and added a centered play icon overlay.
- Added a Choose Frame tool with a video scrubber so users can select a different thumbnail frame manually.

## 0.4.4
- Added automatic replay thumbnails generated from the middle frame of each saved replay.
- Updated the Saved Replays gallery to display a preview image on each replay card.
- Backfills thumbnails for older saved replays the next time the gallery loads.

## 0.4.3
- Added a full-screen darkened countdown overlay with large bright white 3, 2, 1, GO prompts to make the start cue much easier to see.
- Added a brief pop animation to each countdown step while preserving the existing recording flow.

## 0.4.2

### Added
- Start/stop toggle for Camera 1 on the controller dashboard
- Start/stop toggle for each mobile camera page
- Mobile cameras can stop and restart while keeping their assigned camera name

### Changed
- Camera 1 start/stop button now uses the dark blue primary style
- Removed decorative icons from Camera Inputs, Saved Replays, and Protect Storage

## 0.4.1

### Added
- Responsive 1546 × 423 Replay Assistant hero banner at the top of the controller dashboard

### Changed
- Replaced the former logo/status/shortcut top bar with the new gymnastics banner
- Removed the Cameras, Notes, and Settings shortcut tiles from the page header

## 0.4.0

### Added
- Floating pencil button inside the replay video window
- Compact translucent drawing toolbox over the replay
- Pen and eraser tools
- Keyboard shortcuts: D, P, E, Escape, and Command/Control+Z
- Mobile-friendly drawing panel positioning

### Improved
- Drawing controls no longer occupy space above the replay
- Replay automatically pauses when drawing mode is opened
- Drawing controls remain clickable above the annotation canvas
- Accessible labels and panel state

## 0.3.2

### Changed
- Removed Draw on Replay from the main dashboard
- Added the pencil control inside every replay window
- Drawing mode is off when the replay first opens
- Pencil button turns drawing on and off
- Video controls remain usable when drawing mode is off

### Included
- Drawing color picker
- Adjustable line thickness
- Undo
- Clear
- Finger, Apple Pencil, mouse, and trackpad support
