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
import { SEED_WORDS, type SeedWord } from "@/lib/words/seed";
import { shuffle } from "@/lib/speak/shuffle";
import { cancelSpeech, isTtsSupported, speak } from "@/lib/speak/tts";

type DeckEntry = SeedWord;

const subscribeNoop = () => () => {};
const getServerSnapshot = () => false;
const getClientSnapshot = () => true;
function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
}

export default function WordsPage() {
  const utils = trpc.useUtils();
  const isClient = useIsClient();

  const listWords = trpc.words.listWords.useQuery();
  const countsQuery = trpc.words.getCounts.useQuery();
  const recordPractice = trpc.words.recordPractice.useMutation();
  const addWord = trpc.words.addWord.useMutation({
    onSuccess: () => {
      void utils.words.listWords.invalidate();
    },
  });

  const userAdded = listWords.data ?? [];

  const allWords = useMemo<DeckEntry[]>(() => {
    return [
      ...SEED_WORDS,
      ...userAdded.map((w) => ({
        id: w.id,
        text: w.text,
        ipa: w.ipa,
        stressPattern: w.stressPattern,
        meaningZh: w.meaningZh,
        exampleEn: w.exampleEn,
      })),
    ];
  }, [userAdded]);

  const [shuffleNonce, setShuffleNonce] = useState(0);
  const order = useMemo<DeckEntry[]>(
    () => (isClient ? shuffle(allWords) : allWords),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isClient, shuffleNonce, allWords],
  );
  const [pointer, setPointer] = useState(0);

  // Clamp pointer if order shrinks (defensive — v1 doesn't remove words).
  useEffect(() => {
    if (pointer >= order.length && order.length > 0) setPointer(0);
  }, [order.length, pointer]);

  const localPlayCountRef = useRef(0);
  const current = order[pointer];

  const flushIfNeeded = useCallback(
    (wordId: string, count: number) => {
      if (count <= 0) return;
      recordPractice.mutate(
        { wordId, increment: count },
        {
          onSuccess: () => {
            utils.words.getCounts.setData(undefined, (old) => {
              const prev = old ?? {};
              return { ...prev, [wordId]: (prev[wordId] ?? 0) + count };
            });
          },
        },
      );
    },
    [recordPractice, utils],
  );

  const playWord = useCallback(() => {
    if (!current) return;
    localPlayCountRef.current += 1;
    void speak(current.text);
  }, [current]);

  const playSentence = useCallback(() => {
    if (!current) return;
    void speak(current.exampleEn);
  }, [current]);

  const next = useCallback(() => {
    if (!current) return;
    flushIfNeeded(current.id, localPlayCountRef.current);
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

  // Auto-play current word once we're on the client.
  useEffect(() => {
    if (!isClient) return;
    if (!isTtsSupported()) return;
    if (!current) return;
    localPlayCountRef.current += 1;
    void speak(current.text);
    return () => cancelSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointer, isClient, current?.id]);

  // beforeunload flush.
  useEffect(() => {
    const handler = () => {
      if (!current) return;
      flushIfNeeded(current.id, localPlayCountRef.current);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [current, flushIfNeeded]);

  // Keyboard: Space=Word, S=Sentence, →=Next.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;
      if (e.code === "Space") {
        e.preventDefault();
        playWord();
      } else if (e.code === "KeyS") {
        e.preventDefault();
        playSentence();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playWord, playSentence, next]);

  const counts = countsQuery.data ?? {};
  const currentLifetimeCount = current ? counts[current.id] ?? 0 : 0;
  const positionLabel = useMemo(
    () => (order.length > 0 ? `${pointer + 1} / ${order.length}` : "0 / 0"),
    [pointer, order.length],
  );

  // Add modal state.
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const submitAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = addText.trim();
      if (!trimmed) return;
      setAddError(null);
      try {
        await addWord.mutateAsync({ text: trimmed });
        setAddText("");
        setAddOpen(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to add word";
        setAddError(msg);
      }
    },
    [addText, addWord],
  );

  if (!isClient) return <div className="min-h-[80vh]" />;
  if (!isTtsSupported()) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <p className="max-w-md text-center text-sm text-stone-600 dark:text-stone-400">
          Your browser does not support speech synthesis. Try Chrome, Safari, or Edge.
        </p>
      </div>
    );
  }
  if (!current) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <p className="text-sm text-stone-500">Loading words…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
      <p
        data-testid="words-stress"
        className="text-balance text-center text-4xl font-medium tracking-tight text-stone-900 dark:text-stone-100"
      >
        {current.stressPattern}
      </p>
      <p
        data-testid="words-ipa"
        className="mt-4 text-center font-mono text-lg text-stone-600 dark:text-stone-400"
      >
        {current.ipa}
      </p>
      <p
        data-testid="words-meaning"
        className="mt-4 text-center text-base text-stone-700 dark:text-stone-300"
      >
        {current.meaningZh}
      </p>
      <p
        data-testid="words-example"
        className="mt-10 max-w-2xl text-balance text-center text-lg italic leading-relaxed text-stone-700 dark:text-stone-300"
      >
        “{current.exampleEn}”
      </p>

      <div className="mt-12 flex items-center gap-3">
        <button
          type="button"
          data-testid="words-play-word"
          onClick={playWord}
          className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
        >
          ▶ Word
        </button>
        <button
          type="button"
          data-testid="words-play-sentence"
          onClick={playSentence}
          className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
        >
          ▶ Sentence
        </button>
        <button
          type="button"
          data-testid="words-next"
          onClick={next}
          className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
        >
          Next →
        </button>
      </div>

      <div className="mt-10 flex w-full max-w-2xl items-center justify-between text-xs text-stone-400 dark:text-stone-500">
        <button
          type="button"
          data-testid="words-add-open"
          onClick={() => setAddOpen(true)}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-600 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          + Add word
        </button>
        <div className="flex flex-col items-end">
          {currentLifetimeCount > 0 && (
            <span data-testid="words-practiced">Practiced {currentLifetimeCount} times</span>
          )}
          <span data-testid="words-position">{positionLabel}</span>
        </div>
      </div>

      {addOpen && (
        <div
          data-testid="words-add-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <form
            onSubmit={submitAdd}
            className="w-[min(90vw,420px)] rounded-xl bg-white p-6 shadow-xl dark:bg-stone-900"
          >
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Add word
            </h2>
            <input
              autoFocus
              data-testid="words-add-input"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder="e.g. epitome"
              className="mt-4 w-full rounded-md border border-stone-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-stone-700"
            />
            {addError && (
              <p data-testid="words-add-error" className="mt-2 text-xs text-red-600">
                {addError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  setAddError(null);
                  setAddText("");
                }}
                className="rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="words-add-submit"
                disabled={addWord.isPending || addText.trim().length === 0}
                className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
              >
                {addWord.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
