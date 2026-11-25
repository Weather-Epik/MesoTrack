const DEFAULT_LAT = 35.3395;
const DEFAULT_LNG = -97.4867;
const map = L.map("map", { zoomControl: false }).setView(L.latLng(DEFAULT_LAT, DEFAULT_LNG), 11);
L.control.zoom({ position: "bottomright" }).addTo(map);

const esriHost = "https://server." + "arcgisonline.com";
const darkStreetTiles = L.tileLayer(esriHost + "/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", { attribution: "&copy; Esri, OpenStreetMap", maxZoom: 18 });
const darkStreetLabels = L.tileLayer(esriHost + "/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18 });
const lightStreetTiles = L.tileLayer(esriHost + "/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", { attribution: "&copy; Esri, OpenStreetMap", maxZoom: 18 });

darkStreetTiles.addTo(map);
darkStreetLabels.addTo(map);

const i18n = {
    en: {
        hudStatus: "STATUS", hudRoute: "ETA / ROUTE", hudTarget: "INTERCEPT TARGET",
        myGps: "My GPS", gpsActive: "GPS Active", gpsBlocked: "GPS Blocked", noGps: "No GPS",
        panelTitle: "Cell Controls", dropHere: "Drop Here",
        hint: 'Drag the <strong>↺ icon</strong> onto the supercell – road route updates live!',
        txtSize: "Cell Size (Radius):", txtWind: "Max Wind / Rotation:", txtSpeed: "Storm Speed:",
        txtDir: "Storm Motion:", txtEta: "Intercept Lead Time:", txtSpin: "Rotation:",
        cyclonic: "Cyclonic (↺)", anticyclonic: "Anticyclonic (↻)",
        stageCumulus: "CUMULUS / UPDRAFT", stageMeso: "MESOCYCLONE", stageTds: "TORNADO / TDS ALERT",
        noRoad: "No road nearby", routeLoading: "Loading route...",
        dragTip: "Drag me onto the supercell!", interceptTip: "Optimal Intercept Point (Dry Inflow)",
        userTip: "Your Location (GPS or draggable)"
    },
    de: {
        hudStatus: "STATUS", hudRoute: "FAHRTZEIT / ROUTE", hudTarget: "INTERCEPT-ZIEL",
        myGps: "Mein GPS", gpsActive: "GPS Aktiv", gpsBlocked: "GPS blockiert", noGps: "Kein GPS",
        panelTitle: "Zellen-Steuerung", dropHere: "Zelle zu mir",
        hint: 'Ziehe das <strong>↺-Symbol</strong> auf die Zelle – die Straßenroute passt sich live an!',
        txtSize: "Zellen-Größe (Radius):", txtWind: "Max. Wind / Rotation:", txtSpeed: "Zuggeschwindigkeit:",
        txtDir: "Zugrichtung:", txtEta: "Vorhalt (Intercept-Zeit):", txtSpin: "Drehrichtung:",
        cyclonic: "Zyklonal (↺)", anticyclonic: "Antizyklonal (↻)",
        stageCumulus: "CUMULUS / AUFWIND", stageMeso: "MESOZYKLONE", stageTds: "TORNADO / TDS-GEFAHR",
        noRoad: "Keine Straße nah", routeLoading: "Route lädt...",
        dragTip: "Ziehe mich auf die Superzelle!", interceptTip: "Optimaler Intercept-Punkt (Trockener Inflow)",
        userTip: "Dein Standort (GPS oder ziehbar)"
    }
};

let state = {
    lang: "en", stormLat: DEFAULT_LAT - 0.06, stormLng: DEFAULT_LNG - 0.09,
    userLat: DEFAULT_LAT, userLng: DEFAULT_LNG, hasRealGps: false,
    sizeKm: 6, windMph: 145, speedKmh: 55, directionDeg: 45, etaMinutes: 30, cyclonic: true
};

let routeTimeout = null;
let gpsWatchStarted = false;

function calculateVortexScale(mph) {
    if (mph < 65) return { code: "VS-0", level: 0 };
    const vsIndex = Math.floor((mph - 81) / 30) + 2;
    const finalIndex = mph <= 80 ? 1 : vsIndex;
    if (finalIndex === 1) return { code: "VS-1", level: 1 };
    if (finalIndex === 2) return { code: "VS-2", level: 2 };
    return { code: "VS-" + finalIndex, level: 3 };
}

function getThemeColors() {
    const s = getComputedStyle(document.documentElement);
    return {
        core: s.getPropertyValue("--core-color").trim() || "#ef4444",
        meso: s.getPropertyValue("--meso-color").trim() || "#f97316",
        cumulus: s.getPropertyValue("--cumulus-color").trim() || "#eab308",
        intercept: s.getPropertyValue("--intercept-color").trim() || "#22c55e",
        route: s.getPropertyValue("--route-color").trim() || "#38bdf8"
    };
}

let colors = getThemeColors();

function moveCoords(lat, lng, distanceKm, bearingDeg) {
    const R = 6371, brng = (bearingDeg * Math.PI) / 180, lat1 = (lat * Math.PI) / 180, lng1 = (lng * Math.PI) / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distanceKm / R) + Math.cos(lat1) * Math.sin(distanceKm / R) * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(distanceKm / R) * Math.cos(lat1), Math.cos(distanceKm / R) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

const initialPoint = L.latLng(state.stormLat, state.stormLng);
const coreCircle = L.circle(initialPoint, { radius: state.sizeKm * 1000, color: colors.core, fillColor: colors.core, fillOpacity: 0.28, weight: 1 }).addTo(map);
const mesoCircle = L.circle(initialPoint, { radius: state.sizeKm * 450, color: colors.meso, fillColor: colors.meso, fillOpacity: 0.32, weight: 3 }).addTo(map);
const stormMarker = L.marker(initialPoint, {
    draggable: true,
    icon: L.divIcon({ className: "", html: '<div class="vortex-drag-icon" id="vortex-symbol">↺</div>', iconSize: L.point(38, 38), iconAnchor: L.point(19, 19) })
}).addTo(map).bindTooltip(i18n.en.dragTip, { direction: "top" });

stormMarker.on("drag", function (e) { const p = e.target.getLatLng(); state.stormLat = p.lat; state.stormLng = p.lng; updateTacticalMap(false); });
stormMarker.on("dragend", function () { updateTacticalMap(true); });

const trackLine = L.polyline(new Array(), { color: "#ffffff", dashArray: "6, 8", weight: 2 }).addTo(map);
const roadRouteLine = L.polyline(new Array(), { color: colors.route, weight: 5, opacity: 0.9 }).addTo(map);
const futureMesoCircle = L.circle(initialPoint, { radius: state.sizeKm * 450, color: "#ffffff", fillOpacity: 0.08, dashArray: "4, 4", weight: 2 }).addTo(map);
const interceptMarker = L.circleMarker(initialPoint, { radius: 9, color: "#ffffff", fillColor: colors.intercept, fillOpacity: 1, weight: 2 }).addTo(map).bindTooltip(i18n.en.interceptTip);

const userMarker = L.marker(L.latLng(state.userLat, state.userLng), {
    draggable: true,
    icon: L.divIcon({ className: "", html: '<div class="user-gps-dot"></div>', iconSize: L.point(16, 16), iconAnchor: L.point(8, 8) })
}).addTo(map).bindTooltip(i18n.en.userTip, { direction: "bottom" });

userMarker.on("dragend", function (e) { const p = e.target.getLatLng(); state.userLat = p.lat; state.userLng = p.lng; updateTacticalMap(true); });

function applyLanguage() {
    const t = i18n[state.lang];
    document.documentElement.lang = state.lang;
    document.getElementById("lbl-hud-status").textContent = t.hudStatus;
    document.getElementById("lbl-hud-route").textContent = t.hudRoute;
    document.getElementById("lbl-hud-target").textContent = t.hudTarget;
    const gpsBtn = document.getElementById("btn-gps");
    if (gpsBtn) gpsBtn.textContent = state.hasRealGps ? t.gpsActive : t.myGps;
    document.getElementById("lbl-panel-title").textContent = t.panelTitle;
    document.getElementById("btn-drop-here").textContent = t.dropHere;
    document.getElementById("lbl-hint").innerHTML = t.hint;
    document.getElementById("txt-size").textContent = t.txtSize;
    document.getElementById("txt-wind").textContent = t.txtWind;
    document.getElementById("txt-speed").textContent = t.txtSpeed;
    document.getElementById("txt-dir").textContent = t.txtDir;
    document.getElementById("txt-eta").textContent = t.txtEta;
    document.getElementById("txt-spin").textContent = t.txtSpin;
    document.getElementById("btn-spin").textContent = state.cyclonic ? t.cyclonic : t.anticyclonic;

    if (state.lang === "en") {
        document.getElementById("lbl-size").textContent = (state.sizeKm * 0.621371).toFixed(1) + " mi";
        document.getElementById("lbl-speed").textContent = Math.round(state.speedKmh * 0.621371) + " mph";
    } else {
        document.getElementById("lbl-size").textContent = state.sizeKm + " km";
        document.getElementById("lbl-speed").textContent = state.speedKmh + " km/h";
    }
    document.getElementById("lbl-wind").textContent = state.windMph + " mph";
    stormMarker.setTooltipContent(t.dragTip);
    interceptMarker.setTooltipContent(t.interceptTip);
    userMarker.setTooltipContent(t.userTip);
}

function fetchRoadRoute(startLat, startLng, endLat, endLng) {
    if (routeTimeout) clearTimeout(routeTimeout);
    const t = i18n[state.lang];
    routeTimeout = setTimeout(function () {
        const url = "https://router." + "project-osrm.org/route/v1/driving/" + startLng + "," + startLat + ";" + endLng + "," + endLat + "?overview=full&geometries=geojson";
        fetch(url).then(function (r) { return r.json(); }).then(function (data) {
            if (data && data.routes && data.routes.length > 0) {
                const route = data.routes.at(0), coords = route.geometry.coordinates, pts = new Array();
                for (let i = 0; i < coords.length; i++) { const pair = coords.at(i); pts.push(L.latLng(pair.at(1), pair.at(0))); }
                roadRouteLine.setLatLngs(pts);
                roadRouteLine.setStyle({ color: colors.route });
                const min = Math.round(route.duration / 60);
                if (state.lang === "en") {
                    document.getElementById("route-info").textContent = min + " min (" + ((route.distance / 1000) * 0.621371).toFixed(1) + " mi)";
                } else {
                    document.getElementById("route-info").textContent = min + " Min (" + (route.distance / 1000).toFixed(1) + " km)";
                }
            } else { document.getElementById("route-info").textContent = t.noRoad; }
        }).catch(function () { document.getElementById("route-info").textContent = t.routeLoading; });
    }, 250);
}

function updateTacticalMap(recalcRoute) {
    colors = getThemeColors();
    const vs = calculateVortexScale(state.windMph), t = i18n[state.lang];
    let activeColor = colors.cumulus, stageText = t.stageCumulus;
if (vs.level === 1 || vs.level === 2) { activeColor = colors.meso; stageText = t.stageMeso; }
else if (vs.level >= 3) { activeColor = colors.core; stageText = t.stageTds; }
const stormPos = L.latLng(state.stormLat, state.stormLng);
const corePos = moveCoords(state.stormLat, state.stormLng, state.sizeKm * 0.65, (state.directionDeg - 65 + 360) % 360);
coreCircle.setLatLng(L.latLng(corePos.lat, corePos.lng)).setRadius(state.sizeKm * 1000).setStyle({ color: colors.core, fillColor: colors.core });
mesoCircle.setLatLng(stormPos).setRadius(state.sizeKm * 450).setStyle({ color: activeColor, fillColor: activeColor });
stormMarker.setLatLng(stormPos);
const sym = document.getElementById("vortex-symbol");
if (sym) sym.textContent = state.cyclonic ? "↺" : "↻";
const end60 = moveCoords(state.stormLat, state.stormLng, state.speedKmh * 1.0, state.directionDeg);
trackLine.setLatLngs(new Array(stormPos, L.latLng(end60.lat, end60.lng)));
const futureMeso = moveCoords(state.stormLat, state.stormLng, state.speedKmh * (state.etaMinutes / 60), state.directionDeg);
futureMesoCircle.setLatLng(L.latLng(futureMeso.lat, futureMeso.lng)).setRadius(state.sizeKm * 450);
const interceptPos = moveCoords(futureMeso.lat, futureMeso.lng, Math.max(2.5, state.sizeKm * 0.75), (state.directionDeg + 90) % 360);
interceptMarker.setLatLng(L.latLng(interceptPos.lat, interceptPos.lng)).setStyle({ fillColor: colors.intercept });
roadRouteLine.setStyle({ color: colors.route });
document.getElementById("storm-stage").textContent = stageText;
document.getElementById("vs-display").textContent = vs.code + " (" + state.windMph + " mph)";
document.getElementById("intercept-coords").textContent = Math.abs(interceptPos.lat).toFixed(3) + (interceptPos.lat >= 0 ? "°N, " : "°S, ") + Math.abs(interceptPos.lng).toFixed(3) + (interceptPos.lng >= 0 ? "°E" : "°W");
const dot = document.getElementById("status-dot");
dot.style.background = activeColor;
dot.style.boxShadow = "0 0 10px " + activeColor;
if (recalcRoute !== false) fetchRoadRoute(state.userLat, state.userLng, interceptPos.lat, interceptPos.lng);
}
function applyUserGps(pos, centerMap) {
const isFirstFix = !state.hasRealGps;
state.hasRealGps = true;
state.userLat = pos.coords.latitude;
state.userLng = pos.coords.longitude;
const userLatLng = L.latLng(state.userLat, state.userLng);
userMarker.setLatLng(userLatLng);
const gpsBtn = document.getElementById("btn-gps");
if (gpsBtn) gpsBtn.textContent = i18n[state.lang].gpsActive;
if (isFirstFix || centerMap) {
map.setView(userLatLng, 11);
if (isFirstFix) {
const startStorm = moveCoords(state.userLat, state.userLng, 10, 225);
state.stormLat = startStorm.lat;
state.stormLng = startStorm.lng;
}
}
updateTacticalMap(true);
}
function locateUser(centerMap) {
const t = i18n[state.lang];
if (!navigator.geolocation) { document.getElementById("btn-gps").textContent = t.noGps; return; }
navigator.geolocation.getCurrentPosition(function (pos) { applyUserGps(pos, centerMap); }, function () { document.getElementById("btn-gps").textContent = t.gpsBlocked; }, { enableHighAccuracy: true, timeout: 10000 });
if (!gpsWatchStarted) {
gpsWatchStarted = true;
navigator.geolocation.watchPosition(function (pos) { applyUserGps(pos, false); }, function () {}, { enableHighAccuracy: true });
}
}
document.getElementById("lang-select").addEventListener("change", function (e) { state.lang = e.target.value; applyLanguage(); updateTacticalMap(true); });
document.getElementById("rng-size").addEventListener("input", function (e) { state.sizeKm = parseInt(e.target.value, 10); applyLanguage(); updateTacticalMap(true); });
document.getElementById("rng-wind").addEventListener("input", function (e) { state.windMph = parseInt(e.target.value, 10); applyLanguage(); updateTacticalMap(false); });
document.getElementById("rng-speed").addEventListener("input", function (e) { state.speedKmh = parseInt(e.target.value, 10); applyLanguage(); updateTacticalMap(true); });
document.getElementById("rng-dir").addEventListener("input", function (e) { state.directionDeg = parseInt(e.target.value, 10); document.getElementById("lbl-dir").textContent = state.directionDeg + "°"; updateTacticalMap(true); });
document.getElementById("sel-eta").addEventListener("change", function (e) { state.etaMinutes = parseInt(e.target.value, 10); updateTacticalMap(true); });
document.getElementById("btn-spin").addEventListener("click", function () { state.cyclonic = !state.cyclonic; applyLanguage(); updateTacticalMap(false); });
document.getElementById("btn-gps").addEventListener("click", function () { locateUser(true); });
document.getElementById("btn-drop-here").addEventListener("click", function () { const c = map.getCenter(); state.stormLat = c.lat; state.stormLng = c.lng; updateTacticalMap(true); });
document.getElementById("theme-select").addEventListener("change", function (e) {
const theme = e.target.value;
document.documentElement.setAttribute("data-theme", theme);
if (theme === "daylight") { map.removeLayer(darkStreetTiles); map.removeLayer(darkStreetLabels); lightStreetTiles.addTo(map); }
else { map.removeLayer(lightStreetTiles); darkStreetTiles.addTo(map); darkStreetLabels.addTo(map); }
updateTacticalMap(false);
});
const toggleBtn = document.getElementById("btn-toggle-panel");
if (toggleBtn) {
toggleBtn.addEventListener("click", function (e) {
const body = document.getElementById("panel-body");
body.style.display = body.style.display === "none" ? "flex" : "none";
e.target.textContent = body.style.display === "none" ? "▲" : "▼";
});
}
applyLanguage();
updateTacticalMap(true);
locateUser(true);