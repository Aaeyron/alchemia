// Browser-only: turn a recording (WebM/Opus in Chrome, MP4/AAC in Safari, ...) into the
// format Muse Voice Transcribe accepts: a WAV file with mono, 16-bit PCM at 16 kHz.
// Uses the built-in Web Audio API, no packages.

const SAMPLE_RATE = 16000;

function writeText(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

// Decode the recording, resample it to 16 kHz mono, and wrap it in a 44-byte WAV header.
export async function recordingToWav(recording: Blob): Promise<{ wav: Blob; seconds: number }> {
  const context = new AudioContext();
  const decoded = await context.decodeAudioData(await recording.arrayBuffer());
  await context.close();
  if (decoded.duration < 0.3) return { wav: new Blob(), seconds: decoded.duration };

  // An offline context with 1 channel at 16 kHz mixes down and resamples for us.
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * SAMPLE_RATE), SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  writeText(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(view, 8, "WAVE");
  writeText(view, 12, "fmt ");
  view.setUint32(16, 16, true); // size of the fmt section
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample
  view.setUint16(34, 16, true); // bits per sample
  writeText(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  });

  return { wav: new Blob([view.buffer], { type: "audio/wav" }), seconds: decoded.duration };
}
