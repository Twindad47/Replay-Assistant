import { state } from "./state.js";
import { elements, setText } from "./ui.js";

export function openCurrentReplay() {
  if (!state.lastAttemptBlob) {
    setText(elements.appStatus, "Record an attempt before opening Replay.");
    return;
  }

  openReplayBlob(
    state.lastAttemptBlob,
    0.5,
    document.body?.dataset?.replayTitle || document.title || "Replay Assistant"
  );
}

export function openReplayBlob(
  blob,
  replayRate = 0.5,
  title = "Replay Assistant"
) {
  const allowedRates = [0.25, 0.5, 0.75, 1];
  const initialRate = allowedRates.includes(Number(replayRate))
    ? Number(replayRate)
    : 0.5;
  const downloadFilename = `${safeFilename(title)}.webm`;
  const url = URL.createObjectURL(blob);
  const win = window.open("", "_blank", "width=1280,height=900");

  if (!win) {
    URL.revokeObjectURL(url);
    alert("Allow popups for this page.");
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(title)}</title>

      <style>
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; padding: 18px; background: #f5f7fa; color: #10233c; font-family: Arial, sans-serif; text-align: center; }
        h1 { margin: 0 0 4px; }
        .replay-toolbar { width: min(1220px, 100%); margin: 10px auto 14px; padding: 10px; display: flex; justify-content: space-between; align-items: center; gap: 12px; border: 1px solid #d9e1e8; border-radius: 12px; background: #fff; box-shadow: 0 5px 18px rgba(32,55,79,.07); }
        .speed-control-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .replay-toolbar-label { color: #63748a; font-size: 14px; font-weight: 800; }
        .speed-buttons { display: flex; gap: 6px; flex-wrap: wrap; }
        .speed-button { min-width: 58px; min-height: 40px; padding: 7px 11px; border: 1px solid #cad5df; border-radius: 8px; background: #f7f9fb; color: #123b63; font-size: 14px; font-weight: 900; cursor: pointer; }
        .speed-button:hover { background: #eaf1f7; }
        .speed-button.active { border-color: #123b63; background: #123b63; color: #fff; }
        .download-original { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; padding: 8px 14px; border-radius: 8px; background: #123b63; color: #fff; text-decoration: none; font-size: 14px; font-weight: 900; white-space: nowrap; }
        .download-original:hover { background: #0b2b49; }
        .replay-stage { position: relative; width: min(1220px, 100%); margin: 0 auto; line-height: 0; touch-action: none; }
        video { position: relative; z-index: 1; width: 100%; max-height: 72vh; display: block; background: black; border: 4px solid white; border-radius: 14px; box-shadow: 0 8px 30px rgba(32, 55, 79, .12); object-fit: contain; }
        #drawingCanvas { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; border-radius: 14px; cursor: crosshair; touch-action: none; pointer-events: none; }
        #drawingCanvas.drawing-active { pointer-events: auto; }
        #drawingCanvas.eraser-active { cursor: cell; }
        .floating-pencil-button { position: absolute; top: 16px; right: 16px; z-index: 5; width: 48px; height: 48px; padding: 0; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.45); border-radius: 50%; background: rgba(10,25,42,.82); color: white; font-size: 22px; cursor: pointer; box-shadow: 0 5px 18px rgba(0,0,0,.28); backdrop-filter: blur(8px); }
        .floating-pencil-button:hover, .floating-pencil-button.active { background: rgba(18,59,99,.97); border-color: white; }
        .drawing-panel { position: absolute; top: 74px; right: 16px; z-index: 6; width: min(310px, calc(100% - 32px)); padding: 14px; display: none; gap: 14px; border: 1px solid rgba(255,255,255,.25); border-radius: 14px; background: rgba(10,25,42,.92); color: white; line-height: normal; text-align: left; box-shadow: 0 10px 35px rgba(0,0,0,.38); backdrop-filter: blur(12px); }
        .drawing-panel.visible { display: grid; }
        .drawing-panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .icon-button { width: 34px; height: 34px; padding: 0; }
        .drawing-control { display: grid; grid-template-columns: 90px 1fr auto; align-items: center; gap: 10px; font-weight: 700; }
        .drawing-control input[type="color"] { width: 48px; height: 38px; padding: 2px; border: 1px solid rgba(255,255,255,.4); border-radius: 7px; background: white; }
        .drawing-thickness-control input { width: 100%; }
        .drawing-tool-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .drawing-panel button { min-height: 40px; padding: 8px 12px; border: 1px solid rgba(255,255,255,.28); border-radius: 8px; background: rgba(255,255,255,.1); color: white; font-size: 14px; font-weight: 800; cursor: pointer; }
        .drawing-panel button:hover { background: rgba(255,255,255,.2); }
        .drawing-tool-button.active { background: white; color: #123b63; }
        .close-button { margin-top: 16px; min-height: 40px; padding: 9px 14px; border: 0; border-radius: 8px; background: #123b63; color: white; font-size: 18px; font-weight: 800; cursor: pointer; }
        .tool-note { display: none; width: min(1220px, 100%); margin: 8px auto 0; color: #63748a; font-size: 13px; }
        .tool-note.visible { display: block; }
        @media (max-width: 700px) {
          body { padding: 10px; }
          .replay-toolbar { align-items: stretch; flex-direction: column; }
          .speed-control-group { justify-content: center; }
          .speed-buttons { justify-content: center; }
          .download-original { width: 100%; }
          .floating-pencil-button { top: 10px; right: 10px; width: 44px; height: 44px; }
          .drawing-panel { top: 64px; right: 10px; width: calc(100% - 20px); }
          .drawing-control { grid-template-columns: 75px 1fr auto; }
        }
      </style>
    </head>

    <body>
      <h1>${escapeHtml(title)}</h1>

      <div class="replay-toolbar" aria-label="Replay playback controls">
        <div class="speed-control-group">
          <span class="replay-toolbar-label">Playback Speed</span>
          <div class="speed-buttons" role="group" aria-label="Choose replay speed">
            <button class="speed-button" type="button" data-rate="0.25">0.25×</button>
            <button class="speed-button" type="button" data-rate="0.5">0.50×</button>
            <button class="speed-button" type="button" data-rate="0.75">0.75×</button>
            <button class="speed-button" type="button" data-rate="1">1×</button>
          </div>
        </div>
        <a id="downloadOriginal" class="download-original" href="#">Download Original (1×)</a>
      </div>

      <div class="replay-stage" id="replayStage">
        <video id="video" controls playsinline></video>
        <canvas id="drawingCanvas"></canvas>

        <button id="pencilButton" class="floating-pencil-button" type="button" aria-label="Open drawing tools" title="Draw on replay">✏</button>

        <div id="drawingOptions" class="drawing-panel" aria-hidden="true">
          <div class="drawing-panel-heading">
            <strong>Drawing Tools</strong>
            <button id="closeDrawingPanel" class="icon-button" type="button" aria-label="Close drawing tools">✕</button>
          </div>

          <label class="drawing-control">
            <span>Color</span>
            <input id="drawingColor" type="color" value="#ff2d2d">
          </label>

          <label class="drawing-control drawing-thickness-control">
            <span>Thickness</span>
            <input id="drawingThickness" type="range" min="1" max="30" value="6">
            <output id="thicknessValue">6 px</output>
          </label>

          <div class="drawing-tool-row">
            <button id="penToolButton" class="drawing-tool-button active" type="button">✏ Pen</button>
            <button id="eraserToolButton" class="drawing-tool-button" type="button">◻ Eraser</button>
          </div>

          <div class="drawing-tool-row">
            <button id="undoButton" type="button">↶ Undo</button>
            <button id="clearButton" type="button">Clear</button>
          </div>
        </div>
      </div>

      <p id="toolNote" class="tool-note">
        Pause the replay, tap Draw, then use a finger, Apple Pencil, mouse, or trackpad.
      </p>

      <button class="close-button" onclick="window.close()">
        Close Replay
      </button>

      <script>
        const video = document.getElementById("video");
        const replayUrl = ${JSON.stringify(url)};
        const initialReplayRate = ${initialRate};
        const downloadFilename = ${JSON.stringify(downloadFilename)};

        const stage = document.getElementById("replayStage");
        const canvas = document.getElementById("drawingCanvas");
        const context = canvas.getContext("2d");

        const pencilButton = document.getElementById("pencilButton");
        const drawingOptions = document.getElementById("drawingOptions");
        const toolNote = document.getElementById("toolNote");
        const colorInput = document.getElementById("drawingColor");
        const thicknessInput = document.getElementById("drawingThickness");
        const thicknessValue = document.getElementById("thicknessValue");
        const undoButton = document.getElementById("undoButton");
        const clearButton = document.getElementById("clearButton");
        const closeDrawingPanel = document.getElementById("closeDrawingPanel");
        const penToolButton = document.getElementById("penToolButton");
        const eraserToolButton = document.getElementById("eraserToolButton");
        const speedButtons = Array.from(document.querySelectorAll(".speed-button"));
        const downloadOriginal = document.getElementById("downloadOriginal");

        let drawingActive = false;
        let drawing = false;
        let activeTool = "pen";
        let currentStroke = null;
        const strokes = [];

        video.src = replayUrl;
        downloadOriginal.href = replayUrl;
        downloadOriginal.download = downloadFilename;

        function setPlaybackRate(rate) {
          const normalizedRate = [0.25, 0.5, 0.75, 1].includes(Number(rate))
            ? Number(rate)
            : 0.5;

          video.defaultPlaybackRate = normalizedRate;
          video.playbackRate = normalizedRate;

          speedButtons.forEach((button) => {
            const isActive = Number(button.dataset.rate) === normalizedRate;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
          });
        }

        speedButtons.forEach((button) => {
          button.addEventListener("click", () => {
            setPlaybackRate(Number(button.dataset.rate));
          });
        });

        setPlaybackRate(initialReplayRate);

        video.addEventListener("loadedmetadata", async () => {
          video.currentTime = 0;
          setPlaybackRate(initialReplayRate);
          resizeCanvas();

          try {
            await video.play();
          } catch (error) {
            console.log("Autoplay blocked. Press play.", error);
          }
        });

        function resizeCanvas() {
          const rect = stage.getBoundingClientRect();
          const displayScale = window.devicePixelRatio || 1;

          canvas.width = Math.max(1, Math.round(rect.width * displayScale));
          canvas.height = Math.max(1, Math.round(rect.height * displayScale));

          redrawAll();
        }

        function getPoint(event) {
          const rect = canvas.getBoundingClientRect();

          return {
            x: (event.clientX - rect.left) / rect.width,
            y: (event.clientY - rect.top) / rect.height
          };
        }

        function drawStroke(stroke) {
          if (!stroke.points.length) {
            return;
          }

          const width = canvas.width;
          const height = canvas.height;

          context.save();
          context.globalCompositeOperation =
            stroke.tool === "eraser" ? "destination-out" : "source-over";
          context.strokeStyle = stroke.color;
          context.lineWidth =
            stroke.thickness * (window.devicePixelRatio || 1);
          context.lineCap = "round";
          context.lineJoin = "round";
          context.beginPath();

          stroke.points.forEach((point, index) => {
            const x = point.x * width;
            const y = point.y * height;

            if (index === 0) {
              context.moveTo(x, y);
            } else {
              context.lineTo(x, y);
            }
          });

          if (stroke.points.length === 1) {
            const point = stroke.points[0];

            context.lineTo(
              point.x * width + 0.01,
              point.y * height + 0.01
            );
          }

          context.stroke();
          context.restore();
        }

        function redrawAll() {
          context.clearRect(0, 0, canvas.width, canvas.height);

          strokes.forEach(drawStroke);

          if (currentStroke) {
            drawStroke(currentStroke);
          }
        }

        function startDrawing(event) {
          if (!drawingActive) {
            return;
          }

          drawing = true;
          canvas.setPointerCapture(event.pointerId);

          currentStroke = {
            tool: activeTool,
            color: colorInput.value,
            thickness: Number(thicknessInput.value),
            points: [getPoint(event)]
          };

          redrawAll();
          event.preventDefault();
        }

        function continueDrawing(event) {
          if (!drawing || !currentStroke) {
            return;
          }

          currentStroke.points.push(getPoint(event));
          redrawAll();
          event.preventDefault();
        }

        function finishDrawing(event) {
          if (!drawing || !currentStroke) {
            return;
          }

          drawing = false;
          currentStroke.points.push(getPoint(event));
          strokes.push(currentStroke);
          currentStroke = null;
          redrawAll();

          if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
          }

          event.preventDefault();
        }

        function setDrawingActive(active) {
          drawingActive = active;
          canvas.classList.toggle("drawing-active", drawingActive);
          pencilButton.classList.toggle("active", drawingActive);
          drawingOptions.classList.toggle("visible", drawingActive);
          toolNote.classList.toggle("visible", drawingActive);
          drawingOptions.setAttribute("aria-hidden", String(!drawingActive));
          pencilButton.setAttribute("aria-label", drawingActive ? "Close drawing tools" : "Open drawing tools");

          if (drawingActive && !video.paused) {
            video.pause();
          }
        }

        function setActiveTool(tool) {
          activeTool = tool;
          penToolButton.classList.toggle("active", tool === "pen");
          eraserToolButton.classList.toggle("active", tool === "eraser");
          canvas.classList.toggle("eraser-active", tool === "eraser");
        }

        pencilButton.addEventListener("click", () => setDrawingActive(!drawingActive));
        closeDrawingPanel.addEventListener("click", () => setDrawingActive(false));
        penToolButton.addEventListener("click", () => setActiveTool("pen"));
        eraserToolButton.addEventListener("click", () => setActiveTool("eraser"));

        thicknessInput.addEventListener("input", () => {
          thicknessValue.textContent =
            \`\${thicknessInput.value} px\`;
        });

        undoButton.addEventListener("click", () => {
          strokes.pop();
          redrawAll();
        });

        clearButton.addEventListener("click", () => {
          strokes.length = 0;
          currentStroke = null;
          redrawAll();
        });

        canvas.addEventListener("pointerdown", startDrawing);
        canvas.addEventListener("pointermove", continueDrawing);
        canvas.addEventListener("pointerup", finishDrawing);
        canvas.addEventListener("pointercancel", finishDrawing);

        window.addEventListener("keydown", (event) => {
          const target = event.target;
          if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

          const key = event.key.toLowerCase();
          const speedShortcuts = { "1": 0.25, "2": 0.5, "3": 0.75, "4": 1 };
          if (speedShortcuts[key]) setPlaybackRate(speedShortcuts[key]);
          if (key === "d") setDrawingActive(!drawingActive);
          if (key === "p") setActiveTool("pen");
          if (key === "e") setActiveTool("eraser");
          if (key === "z" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            strokes.pop();
            redrawAll();
          }
          if (key === "escape") setDrawingActive(false);
        });

        video.addEventListener("loadeddata", resizeCanvas);
        window.addEventListener("resize", resizeCanvas);

        new ResizeObserver(resizeCanvas).observe(stage);

        window.addEventListener("beforeunload", () => {
          if (window.opener && !window.opener.closed) {
            window.opener.URL.revokeObjectURL(replayUrl);
          }
        });
      <\/script>
    </body>
    </html>
  `);

  win.document.close();
}

function safeFilename(value) {
  return String(value)
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-") || "replay";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}
