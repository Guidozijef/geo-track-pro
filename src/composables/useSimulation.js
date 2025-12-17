import { reactive, ref } from 'vue';
import { fromLonLat } from 'ol/proj';

export const CONFIG = {
  mapColor: '#0f172a',
  gridColor: '#1e293b',
  routeColor: '#3b82f6',
  routeWidth: 4,
  bufferColor: 'rgba(59, 130, 246, 0.15)',
  bufferBorder: 'rgba(59, 130, 246, 0.3)',
  bufferBorderWidth: 2,
  followZoom: 16,
  traceNormal: '#10b981',
  traceAlert: '#ef4444',
  carColor: '#ffffff',
  pointsCount: 400,
};

const state = reactive({
  playing: false,
  speedMultiplier: 2,
  progress: 0,
  threshold: 30,
  currentScenario: 'normal',
  isDeviating: false,
  logs: [],
  traceHistory: [],
  currentCarPos: { x: 0, y: 0, angle: 0 },
  deviationDistance: 0,
  currentSpeed: 45,
  _lastLogTime: 0,
});

function getCurvePoint(t, p0, p1, p2, p3) {
  const cX = 3 * (p1.x - p0.x),
    bX = 3 * (p2.x - p1.x) - cX,
    aX = p3.x - p0.x - cX - bX;
  const cY = 3 * (p1.y - p0.y),
    bY = 3 * (p2.y - p1.y) - cY,
    aY = p3.y - p0.y - cY - bY;
  const x = aX * Math.pow(t, 3) + bX * Math.pow(t, 2) + cX * t + p0.x;
  const y = aY * Math.pow(t, 3) + bY * Math.pow(t, 2) + cY * t + p0.y;
  return { x, y };
}

const plannedRoute = ref([]);
const deviateRoute = ref([]);

export function useSimulation() {
  // set route from lon/lat array (WGS84), densify and also build a deviateRoute
  const setRouteFromLonLat = (lonlatArray) => {
    if (!lonlatArray || !Array.isArray(lonlatArray) || lonlatArray.length === 0) {
      plannedRoute.value = [];
      deviateRoute.value = [];
      state.progress = 0;
      state.traceHistory = [];
      return;
    }
    const projected = lonlatArray.map(([lon, lat]) => {
      const c = fromLonLat([lon, lat]);
      return { x: c[0], y: c[1] };
    });
    const totalPoints = CONFIG && CONFIG.pointsCount ? CONFIG.pointsCount : 400;
    const segments = Math.max(1, projected.length - 1);
    const pointsPerSegment = Math.max(1, Math.floor(totalPoints / segments));
    const dense = [];
    for (let i = 0; i < projected.length - 1; i++) {
      const a = projected[i];
      const b = projected[i + 1];
      for (let s = 0; s < pointsPerSegment; s++) {
        const t = s / pointsPerSegment;
        dense.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    dense.push(projected[projected.length - 1]);
    plannedRoute.value = dense;

    // build a deviateRoute: copy plannedRoute but add lateral deviation in middle portion
    const dev = [];
    const n = dense.length;
    for (let i = 0; i < n; i++) {
      const p = dense[i];
      let x = p.x;
      let y = p.y;
      // apply deviation between 30% and 70% of the path
      const t = i / (n - 1);
      if (t > 0.3 && t < 0.7) {
        // compute a perpendicular offset using adjacent segment direction
        const prev = dense[Math.max(0, i - 1)];
        const next = dense[Math.min(n - 1, i + 1)];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        // normalize
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len; // left normal
        const ny = dx / len; // left normal
        const offset = 50 * Math.sin(((t - 0.3) / 0.4) * Math.PI); // up to ~50 meters in projection units approx
        x += nx * offset;
        y += ny * offset;
      }
      dev.push({ x, y });
    }
    deviateRoute.value = dev;
    state.progress = 0;
    state.traceHistory = [];
  };
  const initRoutes = (width, height) => {
    const KEY_POINTS = {
      start: { x: 200, y: height * 0.75 },
      cp1: { x: 500, y: 200 },
      cp2: { x: width * 0.6, y: 200 },
      end: { x: width * 0.85, y: height * 0.75 },
      deviateCp1: { x: width * 0.4, y: height * 0.55 },
      deviateCp2: { x: width * 0.5, y: height * 0.85 },
    };

    plannedRoute.value = [];
    deviateRoute.value = [];

    for (let i = 0; i <= CONFIG.pointsCount; i++) {
      let t = i / CONFIG.pointsCount;
      const normalP = getCurvePoint(
        t,
        KEY_POINTS.start,
        KEY_POINTS.cp1,
        KEY_POINTS.cp2,
        KEY_POINTS.end
      );
      plannedRoute.value.push(normalP);

      if (t > 0.3 && t < 0.7) {
        let deviateP = getCurvePoint(
          (t - 0.3) * 2.5,
          normalP,
          KEY_POINTS.deviateCp1,
          KEY_POINTS.deviateCp2,
          KEY_POINTS.end
        );
        let weight = Math.sin(((t - 0.3) / 0.4) * Math.PI);
        deviateRoute.value.push({
          x: normalP.x + (deviateP.x - normalP.x) * weight * 0.8,
          y: normalP.y + (deviateP.y - normalP.y) * weight * 0.8,
        });
      } else {
        deviateRoute.value.push(normalP);
      }
    }
  };

  const updateSimulationFrame = () => {
    if (!state.playing) return;
    let currentPath = state.currentScenario === 'normal' ? plannedRoute.value : deviateRoute.value;
    if (!currentPath || currentPath.length === 0) return;

    const n = currentPath.length;
    // t over [0, n-1]
    const t = state.progress * (n - 1);
    const idx = Math.floor(t);
    const frac = t - idx;

    let carPos;
    if (idx >= n - 1) {
      carPos = currentPath[n - 1];
    } else {
      const p0 = currentPath[idx];
      const p1 = currentPath[idx + 1];
      // linear interpolation for smooth motion
      const x = p0.x + (p1.x - p0.x) * frac;
      const y = p0.y + (p1.y - p0.y) * frac;
      carPos = { x, y };
    }

    // angle: use vector from current interpolated pos to a short-lookahead point
    let angle = 0;
    if (idx >= n - 1) {
      const prev = currentPath[n - 2] || currentPath[n - 1];
      angle = Math.atan2(carPos.y - prev.y, carPos.x - prev.x);
    } else {
      const nextP = currentPath[Math.min(idx + 1, n - 1)];
      angle = Math.atan2(nextP.y - carPos.y, nextP.x - carPos.x);
    }

    state.currentCarPos = { ...carPos, angle };

    // compute minimum distance from current position to route segments (point-to-segment)
    const pointToSegDist = (px, py, x1, y1, x2, y2) => {
      const vx = x2 - x1;
      const vy = y2 - y1;
      const wx = px - x1;
      const wy = py - y1;
      const vlen2 = vx * vx + vy * vy;
      if (vlen2 === 0) return Math.hypot(px - x1, py - y1);
      const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / vlen2));
      const projx = x1 + t * vx;
      const projy = y1 + t * vy;
      return Math.hypot(px - projx, py - projy);
    };

    let minDist = Infinity;
    for (let i = 0; i < plannedRoute.value.length - 1; i++) {
      const a = plannedRoute.value[i];
      const b = plannedRoute.value[i + 1];
      const d = pointToSegDist(carPos.x, carPos.y, a.x, a.y, b.x, b.y);
      if (d < minDist) minDist = d;
    }
    // if route has single point fallback to distance to that point
    if (plannedRoute.value.length === 1) {
      const p = plannedRoute.value[0];
      minDist = Math.hypot(carPos.x - p.x, carPos.y - p.y);
    }
    state.deviationDistance = minDist;
    // consider deviating only when outside the buffer (threshold is buffer radius in meters)
    state.isDeviating = minDist > state.threshold;

    if (state.isDeviating) {
      const now = Date.now();
      if (!state._lastLogTime || now - state._lastLogTime > 2000) {
        addLog(new Date().toLocaleTimeString(), `偏离 ${minDist.toFixed(1)}m`, 'alert');
        state._lastLogTime = now;
      }
    }
    state.traceHistory.push({
      x: state.currentCarPos.x,
      y: state.currentCarPos.y,
      isAlert: state.isDeviating,
    });

    state.progress += 0.0005 * state.speedMultiplier;
    if (state.progress >= 1) {
      state.playing = false;
      addLog('系统', '行程结束', 'info');
    }
  };

  const addLog = (time, msg, type) => {
    state.logs.unshift({ time, msg, type });
  };

  const play = () => {
    if (state.progress >= 1) {
      state.progress = 0;
      state.traceHistory = [];
    }
    state.playing = true;
  };

  const pause = () => (state.playing = false);

  const reset = () => {
    state.playing = false;
    state.progress = 0;
    state.traceHistory = [];
    state.logs = [];
    state.deviationDistance = 0;
    state.isDeviating = false;
  };

  return {
    CONFIG,
    state,
    plannedRoute,
    deviateRoute,
    initRoutes,
    setRouteFromLonLat,
    updateSimulationFrame,
    play,
    pause,
    reset,
  };
}
