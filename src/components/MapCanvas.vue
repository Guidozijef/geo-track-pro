<template>
  <div class="absolute inset-0 z-0">
    <div ref="mapRef" class="block w-full h-full"></div>
  </div>
</template>

<script setup>
  import { ref, onMounted, onUnmounted, watch } from 'vue';
  import { useSimulation } from '../composables/useSimulation';
  import 'ol/ol.css';
  import Map from 'ol/Map';
  import View from 'ol/View';
  import TileLayer from 'ol/layer/Tile';
  import XYZ from 'ol/source/XYZ';
  import { fromLonLat, toLonLat } from 'ol/proj';
  import Polygon from 'ol/geom/Polygon';
  import VectorLayer from 'ol/layer/Vector';
  import VectorSource from 'ol/source/Vector';
  import Feature from 'ol/Feature';
  import LineString from 'ol/geom/LineString';
  import Point from 'ol/geom/Point';
  import Stroke from 'ol/style/Stroke';
  import Style from 'ol/style/Style';
  import Fill from 'ol/style/Fill';
  import CircleStyle from 'ol/style/Circle';
  import RegularShape from 'ol/style/RegularShape';

  const { CONFIG, state, plannedRoute, updateSimulationFrame, play, setRouteFromLonLat } =
    useSimulation();

  const mapRef = ref(null);
  let map = null;
  let vectorSource = null;
  let vectorLayer = null;
  let gridSource = null;
  let gridLayer = null;
  let rafId = null;
  let resizeObserver = null;
  let mapWidth = window.innerWidth;
  let mapHeight = window.innerHeight;

  // plannedRoute will be in map projection coordinates (EPSG:3857)
  // route setting handled by useSimulation.setRouteFromLonLat

  async function buildFeatures() {
    if (!vectorSource) return;
    vectorSource.clear(true);

    if (!plannedRoute.value || plannedRoute.value.length === 0) return;
    // prepare routeCoords and convert to lon/lat for turf
    const routeCoords = plannedRoute.value.map((p) => [p.x, p.y]);
    const lonlatCoords = routeCoords.map((c) => toLonLat(c));
    try {
      const turf = (await import('@turf/turf')).default || (await import('@turf/turf'));
      const line = turf.lineString(lonlatCoords);
      const buff = turf.buffer(line, state.threshold || 30, { units: 'meters' });
      if (buff && buff.geometry && buff.geometry.coordinates && buff.geometry.coordinates.length) {
        // take first polygon ring (outer ring)
        const ring = buff.geometry.coordinates[0];
        // convert ring back to projected coords
        const projRing = ring.map(([lon, lat]) => fromLonLat([lon, lat]));
        const poly = new Feature({ geometry: new Polygon([projRing]) });
        poly.setStyle(
          new Style({
            fill: new Fill({ color: CONFIG.bufferColor }),
            stroke: new Stroke({ color: CONFIG.bufferBorder, width: 1 }),
          })
        );
        vectorSource.addFeature(poly);
      }
    } catch (e) {
      console.warn(
        'turf buffer failed or turf not available, falling back to line buffer rendering',
        e
      );
      const fallbackLine = new Feature({ geometry: new LineString(routeCoords) });
      fallbackLine.setStyle(
        new Style({
          stroke: new Stroke({
            color: CONFIG.bufferColor,
            width: Math.max(1, state.threshold * 2),
            lineCap: 'round',
            lineJoin: 'round',
          }),
        })
      );
      vectorSource.addFeature(fallbackLine);
    }

    // buffer border (thin outline)
    const borderLine = new Feature({ geometry: new LineString(routeCoords) });
    borderLine.setStyle(
      new Style({
        stroke: new Stroke({ color: CONFIG.bufferBorder, width: CONFIG.bufferBorderWidth || 1 }),
      })
    );
    vectorSource.addFeature(borderLine);

    // dashed route
    const dashedLine = new Feature({ geometry: new LineString(routeCoords) });
    dashedLine.setStyle(
      new Style({
        stroke: new Stroke({ color: CONFIG.routeColor, width: CONFIG.routeWidth || 4 }),
      })
    );
    vectorSource.addFeature(dashedLine);

    // trace history: draw individual segments with alert color
    if (state.traceHistory && state.traceHistory.length > 1) {
      for (let i = 1; i < state.traceHistory.length; i++) {
        const p1 = [state.traceHistory[i - 1].x, state.traceHistory[i - 1].y];
        const p2 = [state.traceHistory[i].x, state.traceHistory[i].y];
        const seg = new Feature({ geometry: new LineString([p1, p2]) });
        seg.setStyle(
          new Style({
            stroke: new Stroke({
              color: state.traceHistory[i].isAlert ? CONFIG.traceAlert : CONFIG.traceNormal,
              width: 3,
            }),
          })
        );
        vectorSource.addFeature(seg);
      }
    }

    // car marker
    const carPos = state.currentCarPos || { x: 0, y: 0, angle: 0 };
    const carCoord = [carPos.x, carPos.y];
    const car = new Feature({ geometry: new Point(carCoord) });

    const carStyles = [];
    // halo when playing
    if (state.playing) {
      carStyles.push(
        new Style({
          image: new CircleStyle({
            radius: 40,
            fill: new Fill({
              color: state.isDeviating ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
            }),
          }),
        })
      );
    }

    // triangular car shape with rotation
    carStyles.push(
      new Style({
        image: new RegularShape({
          points: 3,
          radius: 15,
          rotation: carPos.angle || 0,
          angle: 0,
          fill: new Fill({ color: CONFIG.carColor }),
          stroke: new Stroke({ color: CONFIG.carColor }),
        }),
      })
    );

    car.setStyle(carStyles);
    vectorSource.addFeature(car);
  }

  function loop() {
    updateSimulationFrame();
    // if playing and we have a current car pos, center the map on the car (follow)
    if (map && state.playing && state.currentCarPos && Array.isArray(map.getView().getCenter())) {
      try {
        map.getView().setCenter([state.currentCarPos.x, state.currentCarPos.y]);
      } catch (e) {
        // ignore center errors
      }
    }
    // buildFeatures is async (may import turf); don't await to avoid blocking frame loop
    buildFeatures();
    rafId = requestAnimationFrame(loop);
  }

  onMounted(() => {
    mapWidth = window.innerWidth;
    mapHeight = window.innerHeight;

    // background color like original canvas
    if (mapRef.value) mapRef.value.style.backgroundColor = CONFIG.mapColor;

    // tile basemap: CartoDB Dark Matter (open-source dark tiles)
    const tileLayer = new TileLayer({
      source: new XYZ({
        url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        crossOrigin: 'anonymous',
      }),
    });

    // grid layer (separate so we don't recreate every frame)
    gridSource = new VectorSource();
    gridLayer = new VectorLayer({ source: gridSource });

    vectorSource = new VectorSource();
    vectorLayer = new VectorLayer({ source: vectorSource });

    map = new Map({
      target: mapRef.value,
      layers: [tileLayer, gridLayer, vectorLayer],
      view: new View({
        center: fromLonLat([104.0668, 30.6573]), // default center (Chengdu downtown)
        zoom: 14,
      }),
    });

    // sample real route in Chengdu (WGS84 lon,lat) — replace if you have a preferred segment
    const sampleLonLatRoute = [
      [104.00424838216946, 30.675322661985646],
      [104.02296246574662, 30.67202492155451],
      [104.03519281165006, 30.669932242717735],
      [104.04078964298463, 30.667218854901535],
      [104.04731671136818, 30.664025739945444],
      [104.04931641428078, 30.66332206429746],
      [104.05216447600378, 30.66326993997218],
      [104.05328552157692, 30.663035380156984],
      [104.05820836656682, 30.658814753330603],
      [104.05833138085325, 30.656645434723927],
      [104.05977679873757, 30.655640124227645],
      [104.06162201305818, 30.655031641742653],
      [104.06608128099737, 30.655005185895376],
      [104.07106335966188, 30.65138066640364],
      [104.07263880831482, 30.650820226533824],
      [104.07575339834557, 30.65480406533922],
      [104.09051977605338, 30.64820295402869],
    ];

    // convert to projected coords and set as plannedRoute + deviateRoute for simulation
    setRouteFromLonLat(sampleLonLatRoute);

    // center / fit map to route extent so it's guaranteed visible
    if (plannedRoute.value && plannedRoute.value.length > 0) {
      const routeCoords = plannedRoute.value.map((p) => [p.x, p.y]);
      const routeGeom = new LineString(routeCoords);
      try {
        map.getView().fit(routeGeom.getExtent(), { padding: [80, 80, 80, 80], maxZoom: 18 });
      } catch (e) {
        // fallback: center on midpoint
        const mid = plannedRoute.value[Math.floor(plannedRoute.value.length / 2)];
        map.getView().setCenter([mid.x, mid.y]);
      }
      console.info(
        'Planned route length:',
        plannedRoute.value.length,
        'first coord:',
        routeCoords[0]
      );
    } else {
      console.warn('plannedRoute is empty after conversion');
    }

    // do not auto-start simulation here; require user to click Start in the control panel
    if (plannedRoute.value && Array.isArray(plannedRoute.value) && plannedRoute.value.length > 1) {
      console.info('Planned route ready. Click Start to begin simulation.');
    } else {
      console.warn(
        'Planned route not ready or too short; waiting for valid route.',
        plannedRoute.value
      );
    }

    // when user starts playback, zoom to followZoom and center on current car position
    watch(
      () => state.playing,
      (playing) => {
        if (!playing) return;
        if (!plannedRoute.value || plannedRoute.value.length === 0) return;
        const view = map.getView();
        const car = state.currentCarPos || plannedRoute.value[0];
        try {
          if (CONFIG.followZoom) view.setZoom(CONFIG.followZoom);
          view.setCenter([car.x, car.y]);
        } catch (e) {
          console.warn('Failed to center/zoom on play start', e);
        }
      }
    );

    // draw initial grid based on screen pixels
    drawGrid();

    // ensure the viewport matches pixel coords (we invert Y when creating geometries)
    // resize observer to update sizes and inform simulation
    resizeObserver = new ResizeObserver(() => {
      mapWidth = window.innerWidth;
      mapHeight = window.innerHeight;
      map.setTarget(mapRef.value);
      map.updateSize();
      // do not call initRoutes here — it would overwrite the geographic plannedRoute
      drawGrid();
    });
    resizeObserver.observe(document.body);

    loop();
  });

  function drawGrid() {
    if (!gridSource) return;
    gridSource.clear(true);
    const gridSize = 100;
    const lines = [];
    // grid in screen space: map pixels -> map coordinates
    for (let x = 0; x <= mapWidth; x += gridSize) {
      const startCoord = map.getCoordinateFromPixel([x, 0]);
      const endCoord = map.getCoordinateFromPixel([x, mapHeight]);
      if (!startCoord || !endCoord || !Array.isArray(startCoord) || !Array.isArray(endCoord)) {
        // map may not have rendered yet; skip invalid pixel->coord results
        continue;
      }
      const feat = new Feature({ geometry: new LineString([startCoord, endCoord]) });
      feat.setStyle(new Style({ stroke: new Stroke({ color: CONFIG.gridColor, width: 1 }) }));
      gridSource.addFeature(feat);
    }
    for (let y = 0; y <= mapHeight; y += gridSize) {
      const startCoord = map.getCoordinateFromPixel([0, y]);
      const endCoord = map.getCoordinateFromPixel([mapWidth, y]);
      if (!startCoord || !endCoord || !Array.isArray(startCoord) || !Array.isArray(endCoord)) {
        continue;
      }
      const feat = new Feature({ geometry: new LineString([startCoord, endCoord]) });
      feat.setStyle(new Style({ stroke: new Stroke({ color: CONFIG.gridColor, width: 1 }) }));
      gridSource.addFeature(feat);
    }
  }

  onUnmounted(() => {
    if (rafId) cancelAnimationFrame(rafId);
    if (resizeObserver) resizeObserver.disconnect();
    if (map) map.setTarget(null);
  });
</script>
