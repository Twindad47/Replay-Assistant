[README.md](https://github.com/user-attachments/files/29988398/README.md)[Uploading README.md…](# Replay Assistant

Version 0.6.0 is the first hosted online beta of Replay Assistant, with private session codes, QR camera joining, reconnect support, and Render deployment files.

## Online beta

- Each controller page creates a private session code.
- Cameras join by scanning the session QR code or opening its private camera link.
- Camera signaling is isolated to the matching session.
- Camera identities persist across normal reconnects.
- TURN credentials can be supplied with Render environment variables for restrictive networks.
- Saved video files remain in the controller browser.
- See `DEPLOY_RENDER.md` for deployment instructions.


## Camera controls

- The controller dashboard uses a dark blue **Start Camera 1** button.
- Once Camera 1 is running, the button changes to **Stop Camera 1**.
- Each mobile camera page also changes between **Start Camera** and **Stop Camera**.
- A stopped mobile camera can be restarted without opening a new page.

## Replay drawing tools

Open a replay and select the pencil button inside the replay window. Drawing mode pauses the replay and provides:

- Pen and eraser
- Color selector
- Thickness selector
- Undo
- Clear

Drawing works with a mouse, trackpad, finger, or Apple Pencil.
)
