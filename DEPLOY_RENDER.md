# Deploy Replay Assistant v0.6.1 to Render

Replay Assistant is a Node/Express web service with Socket.IO and WebRTC signaling. Render should deploy it as a **Web Service**, not a Static Site.

## 1. Put this project in GitHub

Create a new empty GitHub repository, then upload the contents of this folder. The repository root should contain:

- `package.json`
- `package-lock.json`
- `server.js`
- `render.yaml`
- the `public` folder

From Terminal, you can use:

```bash
git init
git add .
git commit -m "Replay Assistant v0.6.1 homepage restoration"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

## 2. Create the Render service

1. Open the Render Dashboard.
2. Choose **New** and then **Blueprint**.
3. Connect the GitHub repository containing Replay Assistant.
4. Render will read `render.yaml`.
5. Confirm the `replay-assistant-beta` web service and deploy it.

The included Blueprint uses:

- Runtime: Node
- Free instance
- Build command: `npm ci`
- Start command: `npm start`
- Health check: `/api/health`

## 3. Open the deployed address

Render provides an HTTPS address similar to:

```text
https://replay-assistant-beta.onrender.com
```

Open that address on the controller device. Choose a sport. Replay Assistant automatically creates a private session code and QR camera link.

## 4. Connect cameras

1. Open the sport page on the controller or use Coach Controller Mode on the iPad.
2. Scan the QR code with each camera phone.
3. Confirm recording permission on the camera page.
4. Tap **Start Camera**.
5. Wait for the camera card to show **Connected** on the controller.

Only devices using the same private session code can connect together.

## 5. Free Render instance behavior

The free web service sleeps after a period without traffic. The first visit after sleeping can take approximately one minute while Render starts the service. For testing, open the website a minute before practice.

Saved video replays are stored in the controller browser, not on Render's filesystem. Render restarts do not delete browser-saved replays, but clearing browser data does.

## 6. Add TURN for difficult networks

The beta works with STUN by default. Some school, gym, hotel, cellular, and restrictive Wi-Fi networks require a TURN relay.

After obtaining TURN credentials, open the Render service's **Environment** settings and add:

```text
TURN_URLS=turn:YOUR_TURN_HOST:3478?transport=udp,turns:YOUR_TURN_HOST:5349?transport=tcp
TURN_USERNAME=YOUR_USERNAME
TURN_CREDENTIAL=YOUR_PASSWORD
```

Redeploy after saving the variables. The public `/api/config` response will show `turnConfigured: true` when TURN is active.

## 7. Check the service

Open:

```text
https://YOUR_RENDER_ADDRESS/api/health
```

A successful response includes:

```json
{
  "ok": true,
  "service": "Replay Assistant",
  "version": "0.6.1"
}
```

## 8. Read beta feedback

Feedback submitted through the website is written to Render logs with this label:

```text
[REPLAY_ASSISTANT_BETA_FEEDBACK]
```

Open the service's **Logs** page in Render and search for that label.
