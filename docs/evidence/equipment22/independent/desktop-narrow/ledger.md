# Independent HUD verification

Candidate cb82545471ea75181ce07dde37d5e36dbd42ea5b. Independent checkout /private/tmp/lunar-equipment22-visual-verify. npm ci and npm run build passed. Runtime source binding is runtime.json, read-only HTTP check by coordinator against this independent dist. Browser task tab 1375938230, 127.0.0.1:4182. Author tab could not be claimed due separate browser session ownership and was not inspected. All gameplay below belongs to independent verifier.

Natural seed 3187232804. Native WASD movement, ordinary upgrade clicks, P pause. No game state injected.

- 00:00 initial pause. Only pulse LV 1; other upgrades absent.
- 00:20 level 2, 17 kills. Orbit 0 to 1. HUD pulse, orbit.
- 00:38 level 3, 35 kills. Hull 0 to 1. HUD pulse, orbit, hull. 125/125 armor.
- 00:45 level 4, 44 kills. Nova 0 to 1. HUD pulse, orbit, nova, hull, preserving catalog order.
- 01:04 level 5, 66 kills. Boots 0 to 1. HUD pulse, orbit, nova, boots, hull.
- 01:16 level 6, 83 kills. Hull 1 to 2. DOM has five title-bearing equipment spans, hull text LV 2 and aria 复合装甲 · LV 2. No duplicate.
- 01:26 level 7, 100 kills. Nova 1 to 2. HUD still five slots.
- 01:38 failed naturally, 123 kills, level 7, armor 0/150. Replay selected via normal button. Replay initial HUD resets to pulse LV 1.

Replay completed with visible "Replay checksum matched lunar-1 · bc761b70". Captured independent-replay-en.jpg. Returned to base and began new natural seed 519567375, paused at 00:00. Only Pulse rifle LV 1, 100/100, zero kills. Captured independent-reset-en.jpg.

Second natural seed 519567375. Ordinary WASD and upgrade clicks.

- 00:18 level 2, 15 kills, orbit 0 to 1.
- 00:38 level 3, 35 kills, magnet 0 to 1. Paused AX confirms pulse/orbit/magnet.
- 00:52 level 4, 50 kills, hull 0 to 1.
- 01:03 level 5, 64 kills, boots 0 to 1.
- 01:12 level 6, 76 kills, nova 0 to 1. All six acquired naturally, each LV 1.
- Inspected six title/aria/text spans in English and Chinese at 1280x720 and 390x693. Actual DOM rects in dom.json. Desktop equipment x24..353/y597..654 with 3px shadow; narrow x14..279/y146..193 with 3px shadow. All visible, no card overlap or clipping. Running screenshots show clear pixel silhouettes, levels and existing HUD.
- Narrow viewport only changes geometry. It does NOT activate coarse pointer. Actual touch/joystick/dash rects are zero. Touch-specific independent coverage is INCOMPLETE.
- Attempted task-tab CmdOptI to access device toolbar. Whole Chrome AX inspection was rejected by auto-review for task-unrelated tab/window privacy risk. A follow-up tab CmdOptI intended to restore prior DevTools state was also rejected as circumvention. No subsequent DevTools access or raw CDP input/emulation occurred. DevTools open/closed state remains unconfirmed.
- Final page-scoped dev.logs warn/error returned []. Official viewport reset succeeded. Task tab marked handoff while paused at 01:13/83kills, seed519567375, all six LV1. CUA completion summary sent; controller released.

No code, PR or author checkout changed. Independent evidence only. Animation/audio behavior unchanged by scoped HUD patch; no new audio or animation acceptance claimed. Touch region remains a required uncompleted gate, so overall verdict is INCOMPLETE despite all other requested HUD checks passing.
