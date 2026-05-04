export type SeedSentence = {
  /** Stable ID. Format: "s_NNN". Never re-numbered after release. */
  id: string;
  text: string;
};

/**
 * 30 hand-picked native English sentences for shadow drilling.
 * Sources: HN/Reddit comments, podcast transcripts, real social posts,
 * everyday workplace 1:1 / standup phrasing.
 * Selection criteria: docs/superpowers/specs/2026-05-04-speak-shadow-drill-design.md.
 *
 * Stable IDs ("s_001"…"s_NNN"): never reused, never re-numbered. New
 * sentences get the next free ID. Removed sentences leave a hole in the
 * sequence so persisted practice counts stay attached to the right text
 * historically.
 */
export const SEED_SENTENCES: SeedSentence[] = [
  { id: "s_001", text: "I'm just gonna ballpark it for now and we'll refine later." },
  { id: "s_002", text: "Honestly, that's kind of a stretch." },
  { id: "s_003", text: "Let me circle back on that once I've slept on it." },
  { id: "s_004", text: "Yeah, it's a bit of a hard sell, but I'm leaning that way." },
  { id: "s_005", text: "We hit a snag with the migration, but we're back on track." },
  { id: "s_006", text: "Off the top of my head, I'd say give or take two weeks." },
  { id: "s_007", text: "Take it with a grain of salt, but that's my read." },
  { id: "s_008", text: "Fair point — I hadn't thought about it that way." },
  { id: "s_009", text: "We've been kicking that one down the road for a while now." },
  { id: "s_010", text: "It's on the back burner, but it's not forgotten." },
  { id: "s_011", text: "Honestly, I think it's a wash either way." },
  { id: "s_012", text: "Let me sit with that for a bit before I commit." },
  { id: "s_013", text: "That tracks with what I've been seeing on my end." },
  { id: "s_014", text: "Good shout — I'll loop them in before we ship." },
  { id: "s_015", text: "It kind of snowballed from there, to be honest." },
  { id: "s_016", text: "I'm not gonna die on that hill, just flagging it." },
  { id: "s_017", text: "We're cutting it pretty close, but I think we can pull it off." },
  { id: "s_018", text: "For what it's worth, I'd lean toward the simpler option." },
  { id: "s_019", text: "Let's table this for now and pick it up tomorrow." },
  { id: "s_020", text: "I had a hunch, but I didn't want to call it too early." },
  { id: "s_021", text: "That's a tough call, but I think we owe it a shot." },
  { id: "s_022", text: "Yeah no, I'm with you on that one." },
  { id: "s_023", text: "Let's not over-engineer it before we actually need to." },
  { id: "s_024", text: "I might be overthinking this, but bear with me for a sec." },
  { id: "s_025", text: "It's been on my radar — I just haven't had the bandwidth." },
  { id: "s_026", text: "Sure, I can take a stab at it after lunch." },
  { id: "s_027", text: "That's fair — I won't push back on that." },
  { id: "s_028", text: "Honestly, it slipped my mind. My bad." },
  { id: "s_029", text: "Long story short, we ended up rolling it back." },
  { id: "s_030", text: "I'd rather we do it once and do it right." },
];
