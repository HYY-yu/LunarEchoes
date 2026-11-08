# Touch verification supplement

Independent verifier head: cb82545471ea75181ce07dde37d5e36dbd42ea5b.
Original result.md remains unchanged. This supplement records the authorized one-time kernel bootstrap recovery and subsequent live evidence.

Six-equipment touch-region overlap: PASS.
Joystick operation: PASS with Chrome emulation and native pointer drag.
Dash effect: INCOMPLETE. Click dispatch alone is not treated as successful dash activation.

Environment was Google Chrome extension browser id 1, own task tab 1375938233, local http://127.0.0.1:4186. Task-scoped supported CDP setTouchEmulationEnabled enabled true/maxTouchPoints 1 and setDeviceMetricsOverride 390x693/deviceScaleFactor 1/mobile true both returned {}. A normal reload initialized the application. Read-only Runtime.evaluate returned coarse true, maxTouchPoints 1, width 390, height 693. This is desktop Chrome emulation, not a physical phone or physical two-finger test.

Own detached clone /private/tmp/equipment22-touch-clone was fetched at the exact candidate head. npm ci and npm run build succeeded. PORT=4186 node scripts/serve.mjs started with session 78036. runtime.json contains coordinator's independent HTTP comparison of all 11 served resources with another non-author clone, all HTTP 200 and equal. No source edits occurred.

Natural first game seed 507133696 acquired nova at 00:38, orbit at 00:41, magnet at 00:54, boots at 01:01, hull at 01:21. All six were LV 1 at level 6 and 90 kills. No seed, World, health, clock or CSS state was injected. Native WASD movement collected energy. Native joystick drag from [75,573] to [112,573] at 00:17 visibly shifted the background while the player remained camera-centered. frame-line213.jpg and frame-line224.jpg preserve the before/after scene.

frame-line287.jpg is the original six-equipment running screenshot at 01:21 with touch controls visible. Its SHA256 is d997e6069d82a7d85866708a631fdcecb0cd513bb001084fcd8729c39ba3946a. The six entries occupied x14..279 and y146..193. Each 40x47 entry had a 3px right/down shadow. Including shadows, occupied bounds ended at x282/y196. Joystick bounds were x20..130/y518..628. Dash bounds were x294..370/y537..613. Thus the closest vertical gap from equipment shadow to joystick was 322px and to dash was 341px. No entry or shadow overlapped either actual control region. Read-only DOM observations include title, aria, LV, display, shadow and rect values in observations.json.

The first game naturally failed at 01:28, before the attempted second combined drag/dash could complete. Its `Node does not have a layout object` error is retained and is not counted as successful input.

A normal redeploy produced second seed 2158645206 to isolate dash input. Clicking dash with no direction did not cause dash, consistent with the existing direction requirement. Native D hold and dash click invoked concurrently produced movement but no captured cooldown; the verifier does not infer successful dash. An attempt to hold direction explicitly with task-scoped Input.dispatchKeyEvent returned `This method is not supported through raw CDP. Use tab.cua.type(...) or tab.cua.keypress(...) instead.` No alternate transport was attempted after this unsupported response. Dash effect remains unverified. This is an input automation limitation, not a demonstrated game defect.

Task-specific warning/error console query returned []. Cleanup disabled touch emulation, cleared device metrics, and closed own tab successfully. No other user tabs or whole-application data were accessed. CUA completion summary was accepted. The local server is retained temporarily for coordinator's read-only resource verification.

Raw screenshots were decoded without alteration from this verifier's exact session 01a1b940-872d-7b03-8965-1492c9919eca after checking session_meta.id and project cwd. frames.json preserves source lines, original hashes and byte counts. Re-extract with `python3 /private/tmp/equipment22-touch-evidence/extract.py`.

Prove It Works kept geometry PASS separate from unobserved Dash effect. The original timeout INCOMPLETE and recovery history remain available in result.md and recovery.md.
