# Slipway

Four harbor games on one pier.

| Game | What you do |
| --- | --- |
| Meshline | Two benches, nine relays. Chart, shear, mend, and hold five. |
| Kiln | Crates fall in the drying shed. Fill a row and it burns off. |
| Eel | A lantern eel on the night grid. Eat the glow. Do not knot. |
| Slip | Cross the pier. Ring every bell. |

**Repository:** [boss974829/slipway](https://github.com/boss974829/slipway)

## Play

```bash
npm install
npm run dev
```

Open the pier, then pick a bench. Best marks stay in this browser only.

Meshline rules live in [src/lib/meshline/engine.ts](src/lib/meshline/engine.ts). Kiln, Eel, and Slip are canvas games under `src/components`.
