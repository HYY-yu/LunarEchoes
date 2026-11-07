PR18 independent UI acceptance

Exact head: `32eedecd1af8117a66e3a117f070290b63a6ad8b`. Final verdict: PASS for Issue16 UI scope.

The earlier INCOMPLETE state was resolved after the user unlocked the Mac. Current limits below remain explicit.

| View | Desktop zh | Desktop en | Narrow zh | Narrow en |
| --- | --- | --- | --- | --- |
| menu | desktop-zh-menu.jpg | desktop-en-menu.png | phone-zh-menu.png | phone-en-menu.png |
| hud | desktop-zh-hud-final.jpg | desktop-en-hud.jpg | phone-zh-hud.jpg | phone-en-hud.jpg |
| upgrade | desktop-zh-upgrade.jpg | desktop-en-upgrade.jpg | phone-zh-upgrade.jpg | phone-en-upgrade.jpg |
| pause | desktop-zh-pause.jpg | desktop-en-pause.jpg | phone-zh-pause.jpg | phone-en-pause-final.jpg |
| victory | desktop-zh-victory.png | desktop-en-victory.png | phone-zh-victory.png | phone-en-victory.png |
| failure | /private/tmp/lunar-ui16-265f-evidence/desktop-loss-zh.png | /private/tmp/lunar-ui16-265f-evidence/desktop-loss-en.png | /private/tmp/lunar-ui16-265f-evidence/narrow-loss-zh.png | /private/tmp/lunar-ui16-265f-evidence/narrow-loss-en.png |

All current-head matrix images were read as real artifacts. Historical failure images and replay-layout PNG are265f independent captures, never represented as new32eedec captures. version-map.json independently proves all source/CSS/HTMLbody bytes unchanged.

Natural victory seed1018780150:03:00,440kills,LV11,HP92/100. Actual replay endpoint AX matched8ad2f77c. Keyboard2secondD,S,A,W batches and visible upgrades only. Joystick300ms right press moved fixed landmarks, before/after PNG preserved. Focused d+real Dash click100ms followed immediately by P yielded actual DOM dash2.4,phasepaused. No seed, World, tick or input-handler injection.

Short acceptance session seed3337442160 naturally reached upgrade00:16. Desktop running HUD session seed2600729153 used Desktop pointer type then reload to initialize the correct input mode. Native AX click positions shifted under DevTools scaling; actual screenshot coordinates and real P key were used to recover. Rejected attempted frames remain labeled and excluded.

Motion six real frames span2124ms at420/442/432/415/415ms sample intervals. Root encoded root-motion-sampled.mp4,6frames390x694,2.16seconds,109293bytes. No interpolation; only bottom1black row codec pad. Original frames and decoded first/last reviewed. This demonstrates sampled real animation and stable HUD only, not target-device FPS or continuous recording.

Final tab.dev warn/error query returned[]. Native Console screenshot showed only current task Info session events and No issues. Console screenshot stays local; console-final.json is the concise portable record. Device mode was disabled and DevTools closed; CUA control ended with completion_summary.

Raw-frame export is reproducible with python3 extract-frames.py while the exact task transcript remains available. It reads only01a1b556 task session, validates original source byte lengths and FNV32, then saves byte-identical JPEG and SHA256. No downloaded images, external runtime assets or production source changes.

Limits:
- Physical phone, simultaneous two-finger input, other browsers and device FPS not tested
- Audio implementation unchanged; no new audio listening acceptance claimed
- Current-head victory replay endpoint observed by AX8ad2f77c; original task tab later expired, so no new endpoint PNG. Historical265f endpoint PNG is explicitly mapped by identical JS/CSS/body and is a different run/checksum
- Desktop CSS viewport1280x720; DevTools PNG1280x720, raw tab screenshot JPEG1216x684 because Fit to window. Narrow CSS390x693; DevTools PNG780x1386, raw JPEG390x693
- Motion video is actual sampled frames with true timestamps, no interpolation, one bottom black row for codec; no continuous recording or FPS assertion
- rejected-desktop-zh-hud.jpg captured title after a native AX click missed; rejected-mislabeled-pause-actually-zh.jpg had wrong initial language filename. Both excluded from matrix and acceptance
- Screenshot.app hung872.5s and Preview app timed out60.6s; both routes stopped, no recording produced. dataURL export policy rejected and stopped; successful byte transfer used only exact current task transcript local I/O

Independent current-head npm run verify also completed with exit0:51/51tests,0failed,gzip24669/153600bytes. Seeds208907/42/101 checksums d1326dd8/c8b73f95/22cc59b2. Full actual output: verify.log.
