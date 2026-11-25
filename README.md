# 🌪️ MesoTrack – Chaser Tactical Radar & Routing HUD

**MesoTrack** is a lightweight, real-time tactical storm-chasing web app designed for fast decision-making in the field. Place or drag a supercell directly onto the map, adjust its size, storm motion, and rotation speed, and **MesoTrack** automatically calculates a safe **dry-inflow intercept point** along with live turn-by-turn **road routing** and **Vortex-Scale (VS)** classification.

---

## ✨ Key Features

* **🎯 Draggable Supercell & Core Modeling:** Drag the `↺` mesocyclone marker directly onto any storm cell, adjust cell radius (`mi` / `km`), storm motion heading, and forward speed.
* **🛣️ Live Road Routing & ETA (OSRM):** Automatically calculates the fastest driving route over real roads from your current GPS location to the optimal dry-inflow intercept point (90° right of storm motion) for `+15`, `+30`, or `+45` minute lead times.
* **📊 Built-in Vortex-Scale (VS-Scale) Engine:** Real-time wind/rotation classification from `VS-0` up to `VS-6+` powered by the [Vortex-Scale](https://github.com) standard.
* **🎨 Customizable Radar & HUD Themes:** Switch instantly between **Night Chase (AMOLED)**, **NEXRAD Pro**, **Tactical Green**, and **Daylight High-Contrast**.
* **🌐 Bilingual Interface (`EN` / `DE`):** 1-click toggle between English (`mi` / `mph`) and German (`km` / `km/h`) units and labels.
* **📱 Responsive Multi-Device Layout:** Collapsible control panel optimized for desktop, laptop, mobile phones, and vehicle dashboards.

---

## 🚀 Quick Start & Deployment

1. **Run Locally:**
   Clone or download this repository and open `index.html` in any modern web browser (or via IntelliJ / VS Code Live Server).
2. **Deploy on GitHub Pages:**
   * Go to your repository **Settings → Pages**.
   * Under **Source**, select the `main` branch and `/ (root)` folder, then click **Save**.
   * Your live tactical HUD will be available at `https://github.io` (HTTPS is required for browser GPS access on mobile devices).

---

## 🛠️ Tech Stack

* **HTML5 / CSS3 / Vanilla JavaScript** (Zero build tools or frameworks required)
* **Leaflet.js** for interactive mapping
* **Esri ArcGIS Street & Dark Gray Canvas Tiles** (No API key required)
* **OSRM (Open Source Routing Machine)** for live road routing

---

## 🔗 Related Projects by `mrflims-storms`

* **[Vortex-Scale (VS-Scale) & Calculator](https://github.com):** Open 30-mph step wind rating scale with APIs for JavaScript, Python, Roblox, and Minecraft.
* **[PMW Vortex Scale (Modrinth)](https://modrinth.com):** Minecraft mod integrating the Vortex-Scale directly into ProtoManly's Weather anemometers.

---

## ⚠️ Safety Disclaimer

**MesoTrack** is intended for educational, training, and situational awareness purposes. Always verify conditions with official meteorological warnings (NWS / DWD), maintain safe escape routes, and never drive into hazardous weather.

---

## 📄 License

Licensed under the **Apache-2.0 License**.
