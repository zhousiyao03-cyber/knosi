/**
 * Thin wrapper around window.speechSynthesis.
 *
 * Responsibilities:
 *   - lazily resolve a "good" English voice (prefers en-US, then en-GB,
 *     then any en-*, then the platform default)
 *   - cancel any in-flight utterance before speaking a new one (so rapid
 *     Play / Next clicks don't queue up)
 *   - return a promise that resolves when the utterance ends or errors
 *
 * It does NOT handle the iOS user-gesture gate — the page does that by
 * delaying the first speak() until the user has interacted (key/click).
 */

let cachedVoice: SpeechSynthesisVoice | null = null;

// Voice quality keywords that platforms use to mark their better voices.
// macOS / iOS: "Premium", "Enhanced", "Siri".
// Windows / Edge: "Natural", "Neural", "Online".
// Chrome: "Google" voices are usually network-backed and noticeably nicer than
// the OS compact voices.
const QUALITY_KEYWORDS = [
  "premium",
  "enhanced",
  "siri",
  "natural",
  "neural",
  "online",
  "google",
];

function isQualityVoice(v: SpeechSynthesisVoice): boolean {
  const name = v.name.toLowerCase();
  return QUALITY_KEYWORDS.some((kw) => name.includes(kw));
}

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  // Prefer "quality" en-US voice → quality en-GB → any quality en-* →
  // any en-US → en-GB → any en-* → platform default. Quality wins over
  // dialect: a Premium en-GB voice sounds better than a compact en-US one.
  const enUS = voices.filter((v) => v.lang === "en-US");
  const enGB = voices.filter((v) => v.lang === "en-GB");
  const anyEn = voices.filter((v) => v.lang.startsWith("en"));

  return (
    enUS.find(isQualityVoice) ??
    enGB.find(isQualityVoice) ??
    anyEn.find(isQualityVoice) ??
    enUS[0] ??
    enGB[0] ??
    anyEn[0] ??
    voices[0] ??
    null
  );
}

async function getVoice(): Promise<SpeechSynthesisVoice | null> {
  if (cachedVoice) return cachedVoice;
  if (typeof window === "undefined") return null;
  const synth = window.speechSynthesis;
  if (!synth) return null;

  const immediate = synth.getVoices();
  if (immediate.length > 0) {
    cachedVoice = pickVoice(immediate);
    return cachedVoice;
  }

  // Wait for the asynchronous voice list to load. Resolve fast (300ms) so a
  // missing event on a weird platform does not hang the UI; we'll just fall
  // back to the platform default voice.
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: SpeechSynthesisVoice | null) => {
      if (settled) return;
      settled = true;
      cachedVoice = v;
      resolve(v);
    };
    const handler = () => finish(pickVoice(synth.getVoices()));
    synth.addEventListener("voiceschanged", handler, { once: true });
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", handler);
      finish(pickVoice(synth.getVoices()));
    }, 300);
  });
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export async function speak(text: string): Promise<void> {
  if (!isTtsSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const voice = await getVoice();
  if (voice) utt.voice = voice;
  // Slightly slower than default — natural shadow-drilling pace, and helps
  // mask the choppy prosody of low-quality compact voices.
  utt.rate = 0.95;
  utt.pitch = 1.0;
  utt.lang = voice?.lang ?? "en-US";
  await new Promise<void>((resolve) => {
    utt.onend = () => resolve();
    utt.onerror = () => resolve();
    synth.speak(utt);
  });
}

export function cancelSpeech(): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
}
