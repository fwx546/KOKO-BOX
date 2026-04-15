# Koko Box UI Prototype

This workspace now contains a uni-app-style Vue prototype for a calm, bright, and cute companion-pet interface.

## Run locally

1. Install dependencies: `npm install`
2. Start the H5 dev server: `npm run dev`
3. Build the H5 target: `npm run build`
4. Build the WeChat Mini Program target: `npm run build:mp-weixin`

## WeChat DevTools

1. Open the project root in WeChat DevTools.
2. Ensure `app.json`, `pages.json`, and `manifest.json` are present in the root.
3. Use the `mp-weixin` build output when importing a compiled package.

## Current scope

- UI only, no backend
- Mock cross-device status sync
- Pet attribute dashboard
- Growth and care overview
- Gentle reminder cards
- Hardware display preview
- Lightweight AI chat placeholder

## Notes

- The prototype is intentionally static for now.
- The first goal is to validate layout, color, and information hierarchy.
