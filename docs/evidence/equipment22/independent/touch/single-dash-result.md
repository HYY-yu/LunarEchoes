# Final limited atomic pointer dash verification

Verdict: PASS for keyboard-assisted pointer dash in desktop Chrome touch emulation.

Head cb82545471ea75181ce07dde37d5e36dbd42ea5b. Own clone /private/tmp/equipment22-touch-clone. URL http://127.0.0.1:4186. Own new tab 1375938237. Prior result.md, recovery.md and supplement.md remain unchanged as chronological records.

Coordinator explicitly authorized one final normal UI attempt using the already documented Tab click(target, {key, durationMs}) primitive. The initial returned actual Tab documentation declares key?: string and durationMs?: number and states that key is held across the whole click sequence. No unsupported raw Input command was retried. No whole-app access, DevTools opening, alternate transport or application-state injection occurred.

After normal title navigation, task-scoped supported touch/mobile emulation was enabled, followed by normal reload. The game naturally generated seed 2955725698. Pulse-only level 1 was sufficient to isolate the existing Dash handler. Fresh read-only DOM measured dash x294..370/y537..613, center [332,575].

The single final ordinary UI sequence was:

```javascript
await dashTab.click([332,575], {key:'d', durationMs:100});
await dashTab.pressKey(null,'p');
await dashTab.getAXState();
nodeRepl.write(await dashTab.playwright.locator('#dash').textContent());
```

AX showed paused at 00:08, seed 2955725698, level 1. The exact read-only #dash.textContent result was `2.4`. This positive frozen cooldown directly demonstrates activation of the direction-requiring dash handler. The screenshot also shows the shifted camera background. It is keyboard-assisted pointer input, not a physical two-finger phone test.

Read-only environment result was coarse true, maxTouchPoints 1, width 390, height 693. Warning/error console query returned []. Cleanup disabled touch emulation, cleared device metrics and closed own tab successfully. CUA completion summary was accepted.

Original screenshot frame-line492.jpg, SHA256 993fb27253bd786eebec3693fda262ec26fa89c4db4c945804dc45920381af85, 20388 bytes, was decoded unchanged from this agent's exact session. frames.json and observations.json include this final group. Re-extract with `python3 /private/tmp/equipment22-touch-evidence/extract.py`.

Combined current-head result is PASS for the assigned touch supplement: six naturally acquired equipment entries and shadows do not overlap visible joystick/dash regions, joystick drag visibly moved the scene, and the atomic keyboard-assisted pointer dash produced 2.4 seconds of frozen cooldown. These findings do not claim physical-device or simultaneous two-finger coverage.
