import { Synth, cues, cueGraph } from './audio.js';
const synth = new Synth();
const results = document.getElementById('results');
function report(message) { results.textContent += `${message}\n`; }
function control(parent, label, action) {
  const button = document.createElement('button'); button.textContent = label;
  button.onclick = async () => { try { await action(); } catch (error) { report(`FAIL ${label}: ${String(error)}`); } };
  document.getElementById(parent).append(button);
}
for (const cue of Object.keys(cues)) control('cues', cue, async () => {
  if (cue === 'won' || cue === 'lost') synth.reset();
  await synth.activate(); synth.setSession('running'); synth.play(cue); report(`PLAY ${cue}`);
});
control('controls', 'Run music', async () => { await synth.activate(); synth.setSession('running'); });
control('controls', 'Pause', () => synth.setSession('paused'));
control('controls', 'Resume', async () => { await synth.activate(); synth.setSession('running'); });
control('controls', 'Toggle mute', async () => { synth.setMuted(!synth.muted); if (!synth.muted) await synth.activate(); });
control('controls', 'Toggle hidden', async () => { synth.setHidden(!synth.status.hidden); if (!synth.status.hidden) await synth.activate(); });
control('controls', 'Restart', async () => { synth.reset(); await synth.activate(); synth.setSession('running'); });
control('controls', 'Run lifecycle checks', async () => {
  synth.reset(); synth.setHidden(false); synth.setMuted(false); await synth.activate(); synth.setSession('running'); synth.play('boss');
  synth.setSession('paused'); report(`${synth.status.voices === 0 ? 'PASS' : 'FAIL'} pause stops battle voices`);
  synth.play('ui-confirm'); report(`${synth.status.voices === 1 ? 'PASS' : 'FAIL'} pause permits intentional UI feedback`);
  synth.events(['shot', 'won']); const count = synth.status.voices; synth.events(['won']); synth.setSession('terminal');
  report(`${count === 4 && synth.status.voices === 4 ? 'PASS' : 'FAIL'} terminal priority and no duplicate on rerender`);
  synth.setMuted(true); synth.play('ui-confirm'); report(`${synth.status.voices === 0 ? 'PASS' : 'FAIL'} mute cancels future and active voices`);
  synth.setMuted(false); await synth.activate(); synth.play('ui-confirm'); synth.setHidden(true); report(`${synth.status.voices === 0 ? 'PASS' : 'FAIL'} hidden cancels all voices`);
  synth.setHidden(false); const pending = synth.activate(); synth.reset(); await pending; report(`${!synth.status.ready ? 'PASS' : 'FAIL'} restart invalidates pending activation`);
  report('Listening still required. These checks observe graph ownership, not acoustic silence.');
});
control('controls', 'Export all cues WAV', async () => {
  const names = Object.keys(cues), rate = 44100, spacing = 1.6;
  const context = new OfflineAudioContext(1, Math.ceil(names.length * spacing * rate), rate), gain = context.createGain();
  gain.gain.value = .17; gain.connect(context.destination);
  names.forEach((cue, index) => cueGraph(context, gain, cue, index * spacing + .1, () => {}));
  const buffer = await context.startRendering(), data = buffer.getChannelData(0), bytes = new ArrayBuffer(44 + data.length * 2), view = new DataView(bytes);
  function word(offset, value) { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); }
  word(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); word(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes], { type: 'audio/wav' }));
  });
  const preview = document.createElement('audio'); preview.controls = true; preview.src = url; preview.setAttribute('aria-label', 'Rendered audio cues preview');
  const link = document.createElement('a'); link.href = url; link.download = 'lunar-audio-cues.wav'; link.textContent = 'Download rendered WAV (data URL)';
  document.body.append(preview, link);
  report(names.map((cue, index) => `${(index * spacing + .1).toFixed(1)}s ${cue}`).join('\n'));
  report(`PASS rendered same cue graph, ${buffer.duration.toFixed(1)}s mono WAV. Use the visible audio player or click the data URL download link.`);
});
document.addEventListener('visibilitychange', async () => { synth.setHidden(document.hidden); if (!document.hidden) await synth.activate(); });
window.addEventListener('error', event => report(`ERROR ${event.message}`));
window.addEventListener('unhandledrejection', event => report(`ERROR ${String(event.reason)}`));
setInterval(() => { document.getElementById('status').textContent = JSON.stringify(synth.status, null, 2); }, 100);
