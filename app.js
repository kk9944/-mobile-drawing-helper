const stage = document.querySelector("#stage");
const camera = document.querySelector("#camera");
const emptyState = document.querySelector("#emptyState");
const statusText = document.querySelector("#statusText");
const patternSurface = document.querySelector("#patternSurface");
const patternImage = document.querySelector("#patternImage");
const gridLayer = document.querySelector("#gridLayer");
const handlesLayer = document.querySelector("#handlesLayer");
const handles = [...document.querySelectorAll(".corner-handle")];

const startCamera = document.querySelector("#startCamera");
const cameraButton = document.querySelector("#cameraButton");
const imageInput = document.querySelector("#imageInput");
const panelImageInput = document.querySelector("#panelImageInput");
const lockButton = document.querySelector("#lockButton");
const resetButton = document.querySelector("#resetButton");
const gridButton = document.querySelector("#gridButton");
const flipXButton = document.querySelector("#flipXButton");
const flipYButton = document.querySelector("#flipYButton");
const opacityRange = document.querySelector("#opacityRange");
const scaleRange = document.querySelector("#scaleRange");
const rotateRange = document.querySelector("#rotateRange");

const state = {
  stream: null,
  imageUrl: "",
  imageLoaded: false,
  sourceW: 1,
  sourceH: 1,
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  locked: false,
  grid: true,
  flipX: false,
  flipY: false,
  opacity: 0.45,
  scaleValue: 100,
  rotateValue: 0,
  stageSize: { width: 0, height: 0 },
  drag: null,
};

function setStatus(text) {
  statusText.textContent = text;
}

async function startCameraStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("当前浏览器不支持相机访问");
    return;
  }

  try {
    setStatus("正在启动相机...");
    stopCameraStream();

    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });

    camera.srcObject = state.stream;
    document.body.classList.add("camera-ready");
    setStatus(state.imageLoaded ? "相机已启动" : "相机已启动，请导入图案");
  } catch (error) {
    console.error(error);
    document.body.classList.remove("camera-ready");
    if (!isSecureCameraContext()) {
      setStatus("相机需要 HTTPS 或 localhost 环境");
      return;
    }
    setStatus("相机启动失败，请检查 Safari 权限");
  }
}

function stopCameraStream() {
  if (!state.stream) return;
  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
}

function loadPattern(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("请选择照片或 PNG 图片");
    return;
  }

  if (state.imageUrl) {
    URL.revokeObjectURL(state.imageUrl);
  }

  state.imageUrl = URL.createObjectURL(file);
  patternImage.onload = () => {
    state.imageLoaded = true;
    document.body.classList.add("has-pattern");
    patternSurface.hidden = false;
    handlesLayer.hidden = false;
    setSourceSize(patternImage.naturalWidth || 1, patternImage.naturalHeight || 1);
    unlockPattern();
    resetPatternFit();
    setStatus("图案已导入");
  };
  patternImage.onerror = () => setStatus("图案加载失败");
  patternImage.src = state.imageUrl;
}

function getStageRect() {
  return stage.getBoundingClientRect();
}

function isSecureCameraContext() {
  return (
    location.protocol === "https:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "[::1]"
  );
}

function setSourceSize(naturalWidth, naturalHeight) {
  const maxSurfaceSize = 1200;
  const aspect = naturalWidth / naturalHeight;

  if (aspect >= 1) {
    state.sourceW = maxSurfaceSize;
    state.sourceH = maxSurfaceSize / aspect;
  } else {
    state.sourceH = maxSurfaceSize;
    state.sourceW = maxSurfaceSize * aspect;
  }
}

function updateStageSize() {
  const rect = getStageRect();
  const next = { width: rect.width, height: rect.height };
  const prev = state.stageSize;

  if (prev.width > 0 && prev.height > 0 && state.imageLoaded) {
    const sx = next.width / prev.width;
    const sy = next.height / prev.height;
    state.points = state.points.map((point) => ({
      x: point.x * sx,
      y: point.y * sy,
    }));
  }

  state.stageSize = next;
  renderPattern();
}

function resetPatternFit() {
  if (!state.imageLoaded) return;

  const rect = getStageRect();
  const panelBuffer = Math.max(18, Math.min(rect.width, rect.height) * 0.04);
  const aspect = state.sourceW / state.sourceH;
  let width = rect.width * 0.72;
  let height = width / aspect;

  if (height > rect.height * 0.68) {
    height = rect.height * 0.68;
    width = height * aspect;
  }

  const cx = rect.width / 2;
  const cy = Math.max(panelBuffer + height / 2, rect.height / 2);
  const left = cx - width / 2;
  const top = cy - height / 2;

  state.points = [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height },
  ];
  state.scaleValue = 100;
  state.rotateValue = 0;
  scaleRange.value = "100";
  rotateRange.value = "0";
  renderPattern();
}

function setLocked(nextLocked) {
  state.locked = nextLocked;
  document.body.classList.toggle("is-locked", nextLocked);
  lockButton.classList.toggle("is-active", nextLocked);
  lockButton.textContent = nextLocked ? "重校准" : "锁定";
}

function unlockPattern() {
  setLocked(false);
}

function getCenter(points = state.points) {
  return points.reduce(
    (center, point) => ({
      x: center.x + point.x / points.length,
      y: center.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

function transformPoints(transform) {
  const center = getCenter();
  state.points = state.points.map((point) => transform(point, center));
  renderPattern();
}

function scalePattern(nextValue) {
  const next = Number(nextValue);
  const previous = state.scaleValue || 100;
  const ratio = next / previous;

  state.scaleValue = next;
  transformPoints((point, center) => ({
    x: center.x + (point.x - center.x) * ratio,
    y: center.y + (point.y - center.y) * ratio,
  }));
}

function rotatePattern(nextValue) {
  const next = Number(nextValue);
  const delta = ((next - state.rotateValue) * Math.PI) / 180;
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);

  state.rotateValue = next;
  transformPoints((point, center) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  });
}

function toggleGrid() {
  state.grid = !state.grid;
  gridButton.setAttribute("aria-pressed", String(state.grid));
  renderPattern();
}

function toggleFlip(axis) {
  if (axis === "x") {
    state.flipX = !state.flipX;
    flipXButton.setAttribute("aria-pressed", String(state.flipX));
  } else {
    state.flipY = !state.flipY;
    flipYButton.setAttribute("aria-pressed", String(state.flipY));
  }
  renderPattern();
}

function stagePointFromEvent(event) {
  const rect = getStageRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function moveAllPoints(deltaX, deltaY) {
  state.points = state.points.map((point) => ({
    x: point.x + deltaX,
    y: point.y + deltaY,
  }));
}

function beginDrag(event, mode, pointIndex = null) {
  if (state.locked || !state.imageLoaded) return;

  const pointer = stagePointFromEvent(event);
  state.drag = {
    mode,
    pointIndex,
    pointerId: event.pointerId,
    last: pointer,
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function continueDrag(event) {
  if (!state.drag || event.pointerId !== state.drag.pointerId) return;

  const pointer = stagePointFromEvent(event);
  const deltaX = pointer.x - state.drag.last.x;
  const deltaY = pointer.y - state.drag.last.y;

  if (state.drag.mode === "point") {
    state.points[state.drag.pointIndex] = pointer;
  } else {
    moveAllPoints(deltaX, deltaY);
  }

  state.drag.last = pointer;
  renderPattern();
  event.preventDefault();
}

function endDrag(event) {
  if (!state.drag || event.pointerId !== state.drag.pointerId) return;
  state.drag = null;
  event.preventDefault();
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);

  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) {
        pivot = row;
      }
    }

    if (Math.abs(a[pivot][column]) < 1e-8) {
      return null;
    }

    [a[column], a[pivot]] = [a[pivot], a[column]];
    const divisor = a[column][column];

    for (let col = column; col <= n; col += 1) {
      a[column][col] /= divisor;
    }

    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = a[row][column];
      for (let col = column; col <= n; col += 1) {
        a[row][col] -= factor * a[column][col];
      }
    }
  }

  return a.map((row) => row[n]);
}

function getHomography(from, to) {
  const matrix = [];
  const vector = [];

  for (let index = 0; index < 4; index += 1) {
    const { x, y } = from[index];
    const targetX = to[index].x;
    const targetY = to[index].y;

    matrix.push([x, y, 1, 0, 0, 0, -x * targetX, -y * targetX]);
    vector.push(targetX);
    matrix.push([0, 0, 0, x, y, 1, -x * targetY, -y * targetY]);
    vector.push(targetY);
  }

  const solved = solveLinearSystem(matrix, vector);
  if (!solved) return null;

  return [...solved, 1];
}

function matrix3dFromHomography(h) {
  const [a, c, e, b, d, f, g, h2, i] = h;
  return `matrix3d(${a}, ${b}, 0, ${g}, ${c}, ${d}, 0, ${h2}, 0, 0, 1, 0, ${e}, ${f}, 0, ${i})`;
}

function renderHandles() {
  handles.forEach((handle, index) => {
    const point = state.points[index];
    handle.style.transform = `translate(${point.x - 17}px, ${point.y - 17}px)`;
  });
}

function renderPattern() {
  if (!state.imageLoaded) return;

  const from = [
    { x: 0, y: 0 },
    { x: state.sourceW, y: 0 },
    { x: state.sourceW, y: state.sourceH },
    { x: 0, y: state.sourceH },
  ];
  const homography = getHomography(from, state.points);

  if (homography) {
    patternSurface.style.width = `${state.sourceW}px`;
    patternSurface.style.height = `${state.sourceH}px`;
    patternSurface.style.transform = matrix3dFromHomography(homography);
  }

  patternImage.style.opacity = String(state.opacity);
  patternImage.style.transform = `scale(${state.flipX ? -1 : 1}, ${state.flipY ? -1 : 1})`;
  gridLayer.hidden = !state.grid;
  renderHandles();
}

startCamera.addEventListener("click", startCameraStream);
cameraButton.addEventListener("click", startCameraStream);
imageInput.addEventListener("change", (event) => loadPattern(event.target.files[0]));
panelImageInput.addEventListener("change", (event) => loadPattern(event.target.files[0]));

lockButton.addEventListener("click", () => {
  if (!state.imageLoaded) return;
  setLocked(!state.locked);
});

resetButton.addEventListener("click", () => {
  unlockPattern();
  resetPatternFit();
});

gridButton.addEventListener("click", toggleGrid);
flipXButton.addEventListener("click", () => toggleFlip("x"));
flipYButton.addEventListener("click", () => toggleFlip("y"));

opacityRange.addEventListener("input", (event) => {
  state.opacity = Number(event.target.value) / 100;
  renderPattern();
});

scaleRange.addEventListener("input", (event) => scalePattern(event.target.value));
rotateRange.addEventListener("input", (event) => rotatePattern(event.target.value));

handles.forEach((handle) => {
  handle.addEventListener("pointerdown", (event) => {
    beginDrag(event, "point", Number(handle.dataset.point));
  });
});

patternSurface.addEventListener("pointerdown", (event) => beginDrag(event, "move"));
stage.addEventListener("pointermove", continueDrag);
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

window.addEventListener("beforeunload", () => {
  stopCameraStream();
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
});

const resizeObserver = new ResizeObserver(updateStageSize);
resizeObserver.observe(stage);
updateStageSize();
