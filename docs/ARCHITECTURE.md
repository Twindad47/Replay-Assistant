# Architecture

The Mac controller owns the Camera Manager, dynamic grid, recording canvas, and replay popup.

Remote devices receive a camera ID from the server and send video through WebRTC.

Socket.IO routes offers, answers, and ICE candidates by camera ID.

The recorder draws every connected camera onto a canvas and records that canvas as one replay file.

## Online beta session architecture (v0.6.0)

- The Express/Socket.IO service creates short private session codes.
- Controllers join a session-specific Socket.IO room.
- Cameras are announced only to controllers in the matching session.
- WebRTC video remains peer-to-peer when possible; configured TURN servers relay only when direct connectivity fails.
- Saved replay blobs and thumbnails stay in IndexedDB on the controller browser.
- Session signaling state is intentionally in memory for the initial single-instance Render beta.
