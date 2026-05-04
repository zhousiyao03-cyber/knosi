"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { trpc } from "@/lib/trpc";
import { SEED_SENTENCES, type SeedSentence } from "@/lib/speak/seed";
import { shuffle } from "@/lib/speak/shuffle";
import { cancelSpeech, isTtsSupported, speak } from "@/lib/speak/tts";

// useSyncExternalStore-based client-only flag. Returns false during SSR /
// initial hydration and true once we're on the client. This avoids the
// "setState inside useEffect" pattern that lints want us to avoid.
const subscribeNoop = () => () => {};
const getServerSnapshot = () => false;
const getClientSnapshot = () => true;
function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
}

export default function SpeakPage() {
  const utils = trpc.useUtils();
  const countsQuery = trpc.speak.getCounts.useQuery();
  const recordPractice = trpc.speak.recordPractice.useMutation();

  const isClient = useIsClient();

  // Reshuffle nonce — bumped to force a new order. Initial shuffle happens
  // automatically on the first client render via useMemo below.
  const [shuffleNonce, setShuffleNonce] = useState(0);
  const order = useMemo<SeedSentence[]>(
    () => (isClient ? shuffle(SEED_SENTENCES) : SEED_SENTENCES),
    // shuffleNonce is what triggers re-shuffling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isClient, shuffleNonce],
  );
  const [pointer, setPointer] = useState(0);

  // How many times Play fired for the *current* sentence in this session.
  // Reset on Next.
  const localPlayCountRef = useRef(0);

  // First user gesture — required to bypass iOS Safari's autoplay block.
  const [gestureReceived, setGestureReceived] = useState(false);

  const current = order[pointer]!;

  const flushIfNeeded = useCallback(
    (sentenceId: string, count: number) => {
      if (count <= 0) return;
      recordPractice.mutate(
        { sentenceId, increment: count },
        {
          onSuccess: () => {
            utils.speak.getCounts.setData(undefined, (old) => {
              const prev = old ?? {};
              return {
                ...prev,
                [sentenceId]: (prev[sentenceId] ?? 0) + count,
              };
            });
          },
        },
      );
    },
    [recordPractice, utils],
  );

  const playCurrent = useCallback(() => {
    setGestureReceived(true);
    localPlayCountRef.current += 1;
    void speak(current.text);
  }, [current.text]);

  const next = useCallback(() => {
    const leaving = current;
    const leavingCount = localPlayCountRef.current;
    flushIfNeeded(leaving.id, leavingCount);
    localPlayCountRef.current = 0;

    cancelSpeech();

    setPointer((p) => {
      const np = p + 1;
      if (np >= order.length) {
        setShuffleNonce((n) => n + 1);
        return 0;
      }
      return np;
    });
  }, [current, flushIfNeeded, order.length]);

  // Auto-play on (pointer, gestureReceived). Both prerequisites must hold:
  //   - we have a sentence index
  //   - the user has interacted at least once (so iOS lets us speak)
  // Each fire counts as one Play in localPlayCountRef so we capture the
  // ambient first-listen-of-this-sentence in the practice count.
  useEffect(() => {
    if (!isTtsSupported()) return;
    if (!gestureReceived) return;
    localPlayCountRef.current += 1;
    void speak(current.text);
    return () => cancelSpeech();
  }, [pointer, gestureReceived, current.text]);

  // Best-effort flush on tab close / nav-away.
  useEffect(() => {
    const handler = () => {
      const c = localPlayCountRef.current;
      if (c <= 0) return;
      flushIfNeeded(current.id, c);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [current.id, flushIfNeeded]);

  // Keyboard shortcuts: Space = Play, ArrowRight = Next.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        playCurrent();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playCurrent, next]);

  const counts = countsQuery.data ?? {};
  const currentLifetimeCount = counts[current.id] ?? 0;

  const positionLabel = useMemo(
    () => `${pointer + 1} / ${order.length}`,
    [pointer, order.length],
  );

  if (!isClient) {
    // Render a minimal, deterministic shell on the server to avoid a
    // hydration mismatch when the client swaps in the shuffled order +
    // platform-dependent TTS support check.
    return <div className="min-h-[80vh]" />;
  }

  if (!isTtsSupported()) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <p className="max-w-md text-center text-sm text-stone-600 dark:text-stone-400">
          Your browser does not support speech synthesis. Try Chrome, Safari, or Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
      <p
        data-testid="speak-sentence"
        className="text-balance text-center text-3xl font-medium leading-snug text-stone-900 max-w-3xl dark:text-stone-100"
      >
        {current.text}
      </p>

      <div className="mt-12 flex items-center gap-4">
        <button
          type="button"
          data-testid="speak-play"
          onClick={playCurrent}
          className="rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
        >
          ▶ Play
        </button>
        <button
          type="button"
          data-testid="speak-next"
          onClick={next}
          className="rounded-full border border-stone-300 px-6 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
        >
          Next →
        </button>
      </div>

      <div className="mt-10 flex flex-col items-end self-end text-xs text-stone-400 dark:text-stone-500">
        {currentLifetimeCount > 0 && (
          <span data-testid="speak-practiced">
            Practiced {currentLifetimeCount} times
          </span>
        )}
        <span data-testid="speak-position">{positionLabel}</span>
      </div>
    </div>
  );
}
