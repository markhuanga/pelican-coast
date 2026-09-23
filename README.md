# 风与鱼之歌 · PELICAN COAST

A self-contained static website (except its pinned Three.js ESM CDN dependency and optional Google Fonts). No backend, API key, image asset or build step is needed.

## Run locally

Open a terminal in this folder and run `python -m http.server 8080`, then visit http://localhost:8080. Opening `index.html` as a `file://` URL may fail in some browsers because ES modules follow origin rules. An active Internet connection is required for the Three.js CDN import. The site is ready for Vercel, Netlify, Cloudflare Pages or GitHub Pages as static files.

## Controls

W/S or ↑/↓ — accelerate / brake; A/D or ←/→ — lane change; Space — jump; T — flap and wheelie; C — cycle 5 cameras; M — audio; P/Escape — pause. On mobile, use the on-screen controls or swipe. After 8.5 seconds without driving input, autopilot follows upcoming fish.

## Highlights

Original procedural pelican and bicycle built from geometry, rotating spokes and bicycle wheels, inverse-kinematic pedaling, Verlet-simulated flowing scarf, custom animated ocean and shore-foam shaders, evolving dusk-to-moonlight sky, stars, moon, sun and lighthouse, dynamically generated melodic soundtrack synced to pedal cadence, procedural wind/wave sounds, 14 persistent achievements, 5 cameras and frame-rate adaptive rendering. No third-party artwork is used.

## Deployment

Vercel: create a new project, upload/import this folder, select “Other” as framework, use no build command and `.` as output directory; deploy. The project contains `vercel.json` already. Alternatively run `npx vercel --prod` in this directory while signed into your account.
