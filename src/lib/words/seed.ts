export type SeedWord = {
  /** Stable ID. Format: "w_NNN". Never re-numbered after release. */
  id: string;
  text: string;
  /** General American IPA in slashes. */
  ipa: string;
  /** Syllables joined by "·"; stressed syllable in ALL CAPS. */
  stressPattern: string;
  /** Most common Chinese sense, ≤ 12 hanzi, no semicolons or POS tags. */
  meaningZh: string;
  /** One natural-sounding example, 6–18 words, working-professional casual. */
  exampleEn: string;
};

/**
 * 100 hand-picked words for /words. Authored directly (model-as-author working
 * through each entry against the criteria in
 * docs/superpowers/specs/2026-05-04-words-pronunciation-drill-design.md).
 *
 * Stable IDs ("w_001"…"w_NNN"): never reused, never re-numbered. Removed
 * entries leave a gap so persisted practice counts stay attached to the right
 * historical word.
 *
 * Selection mix:
 *   - stress traps (~25)
 *   - silent letters / tricky vowels (~20)
 *   - commonly mispronounced loans (~10)
 *   - working-professional active vocab (~25)
 *   - hedge / discourse / approval markers (~10)
 *   - emotion / attitude / working-life verbs (~10)
 */
export const SEED_WORDS: SeedWord[] = [
  { id: "w_001", text: "epitome", ipa: "/ɪˈpɪt.ə.mi/", stressPattern: "e·PIT·o·me", meaningZh: "典型代表", exampleEn: "She's the epitome of a calm-under-pressure engineer." },
  { id: "w_002", text: "hierarchy", ipa: "/ˈhaɪ.ə.rɑːr.ki/", stressPattern: "HI·er·ar·chy", meaningZh: "等级制度", exampleEn: "The hierarchy here is pretty flat for a company this size." },
  { id: "w_003", text: "photography", ipa: "/fəˈtɑː.ɡrə.fi/", stressPattern: "pho·TOG·ra·phy", meaningZh: "摄影", exampleEn: "He picked up photography during the lockdowns and never stopped." },
  { id: "w_004", text: "comparable", ipa: "/ˈkɑːm.pər.ə.bəl/", stressPattern: "COM·par·a·ble", meaningZh: "可比的", exampleEn: "Their numbers aren't really comparable to ours yet." },
  { id: "w_005", text: "applicable", ipa: "/ˈæp.lɪ.kə.bəl/", stressPattern: "AP·pli·ca·ble", meaningZh: "适用的", exampleEn: "I'm not sure that rule is applicable to this case." },
  { id: "w_006", text: "preferable", ipa: "/ˈprɛf.ər.ə.bəl/", stressPattern: "PREF·er·a·ble", meaningZh: "更可取的", exampleEn: "Doing it now is preferable to scrambling later." },
  { id: "w_007", text: "admirable", ipa: "/ˈæd.mər.ə.bəl/", stressPattern: "AD·mir·a·ble", meaningZh: "令人钦佩的", exampleEn: "Honestly, the way she handled that was admirable." },
  { id: "w_008", text: "vehement", ipa: "/ˈvi.ə.mənt/", stressPattern: "VE·he·ment", meaningZh: "强烈的", exampleEn: "He was pretty vehement about not shipping it this week." },
  { id: "w_009", text: "exquisite", ipa: "/ɪkˈskwɪz.ɪt/", stressPattern: "ex·QUIS·ite", meaningZh: "精美的", exampleEn: "The detailing on that prototype is exquisite." },
  { id: "w_010", text: "irreparable", ipa: "/ɪˈrɛp.ər.ə.bəl/", stressPattern: "ir·REP·ar·a·ble", meaningZh: "无法修复的", exampleEn: "Don't worry, the damage isn't irreparable." },
  { id: "w_011", text: "lamentable", ipa: "/ˈlæm.ən.tə.bəl/", stressPattern: "LAM·en·ta·ble", meaningZh: "令人遗憾的", exampleEn: "It's lamentable that the deal fell through at the last minute." },
  { id: "w_012", text: "formidable", ipa: "/ˈfɔːr.mɪ.də.bəl/", stressPattern: "FOR·mi·da·ble", meaningZh: "强大的", exampleEn: "They're a formidable competitor in this space." },
  { id: "w_013", text: "inexplicable", ipa: "/ˌɪn.ɪkˈsplɪk.ə.bəl/", stressPattern: "in·ex·PLI·ca·ble", meaningZh: "无法解释的", exampleEn: "The latency spike was honestly inexplicable at the time." },
  { id: "w_014", text: "colonel", ipa: "/ˈkɝː.nəl/", stressPattern: "COL·o·nel", meaningZh: "上校", exampleEn: "His grandfather was a colonel during the war." },
  { id: "w_015", text: "subtle", ipa: "/ˈsʌt.əl/", stressPattern: "SUB·tle", meaningZh: "微妙的", exampleEn: "The change is subtle, but you'll notice it after a day." },
  { id: "w_016", text: "almond", ipa: "/ˈɑː.mənd/", stressPattern: "AL·mond", meaningZh: "杏仁", exampleEn: "I usually grab an almond latte before standup." },
  { id: "w_017", text: "debris", ipa: "/dəˈbriː/", stressPattern: "de·BRIS", meaningZh: "残骸", exampleEn: "There was debris all over the road after the storm." },
  { id: "w_018", text: "rendezvous", ipa: "/ˈrɑːn.deɪ.vuː/", stressPattern: "REN·dez·vous", meaningZh: "约定见面", exampleEn: "Let's rendezvous at the lobby around eleven." },
  { id: "w_019", text: "buffet", ipa: "/bəˈfeɪ/", stressPattern: "buf·FET", meaningZh: "自助餐", exampleEn: "The hotel buffet downstairs is honestly pretty solid." },
  { id: "w_020", text: "depot", ipa: "/ˈdiː.poʊ/", stressPattern: "DE·pot", meaningZh: "仓库", exampleEn: "We dropped the gear at the depot before driving back." },
  { id: "w_021", text: "suite", ipa: "/swiːt/", stressPattern: "SUITE", meaningZh: "套房", exampleEn: "They put us up in a suite, which felt overkill." },
  { id: "w_022", text: "queue", ipa: "/kjuː/", stressPattern: "QUEUE", meaningZh: "队列", exampleEn: "Just throw it on the queue and we'll get to it tomorrow." },
  { id: "w_023", text: "hyperbole", ipa: "/haɪˈpɝː.bə.li/", stressPattern: "hy·PER·bo·le", meaningZh: "夸张说法", exampleEn: "Saying it's the worst design ever is a bit of hyperbole." },
  { id: "w_024", text: "niche", ipa: "/niːʃ/", stressPattern: "NICHE", meaningZh: "细分领域", exampleEn: "It's a small niche, but the people there are loyal." },
  { id: "w_025", text: "facade", ipa: "/fəˈsɑːd/", stressPattern: "fa·CADE", meaningZh: "表面伪装", exampleEn: "The chill attitude is mostly a facade — he's stressed." },
  { id: "w_026", text: "rapport", ipa: "/ræˈpɔːr/", stressPattern: "rap·PORT", meaningZh: "融洽关系", exampleEn: "It takes a few one-on-ones to build real rapport." },
  { id: "w_027", text: "genre", ipa: "/ˈʒɑːn.rə/", stressPattern: "GEN·re", meaningZh: "流派", exampleEn: "That whole genre of B2B tooling exploded last year." },
  { id: "w_028", text: "cliche", ipa: "/kliːˈʃeɪ/", stressPattern: "cli·CHE", meaningZh: "陈词滥调", exampleEn: "I know it's a cliche, but slow and steady actually wins here." },
  { id: "w_029", text: "denouement", ipa: "/ˌdeɪ.nuːˈmɑːn/", stressPattern: "de·noue·MENT", meaningZh: "结局", exampleEn: "The denouement of the launch was actually pretty anticlimactic." },
  { id: "w_030", text: "ennui", ipa: "/ɑːnˈwiː/", stressPattern: "en·NUI", meaningZh: "倦怠", exampleEn: "There's a quiet ennui creeping into the team this quarter." },
  { id: "w_031", text: "concierge", ipa: "/ˌkɑːn.siˈɛrʒ/", stressPattern: "con·ci·ERGE", meaningZh: "礼宾员", exampleEn: "Ask the concierge — they usually know a good place." },
  { id: "w_032", text: "lingerie", ipa: "/ˌlɑːn.ʒəˈreɪ/", stressPattern: "lin·ge·RIE", meaningZh: "女式内衣", exampleEn: "The lingerie brand pivoted to a DTC model last year." },
  { id: "w_033", text: "entrepreneur", ipa: "/ˌɑːn.trə.prəˈnɝː/", stressPattern: "en·tre·pre·NEUR", meaningZh: "创业者", exampleEn: "She's been an entrepreneur since her college days." },
  { id: "w_034", text: "ballpark", ipa: "/ˈbɔːl.pɑːrk/", stressPattern: "BALL·park", meaningZh: "大致估算", exampleEn: "Just give me a ballpark — it doesn't have to be exact." },
  { id: "w_035", text: "bandwidth", ipa: "/ˈbænd.wɪdθ/", stressPattern: "BAND·width", meaningZh: "处理能力", exampleEn: "I don't really have the bandwidth for a third project right now." },
  { id: "w_036", text: "leverage", ipa: "/ˈlɛv.ər.ɪdʒ/", stressPattern: "LEV·er·age", meaningZh: "利用", exampleEn: "We can leverage the existing pipeline instead of rebuilding it." },
  { id: "w_037", text: "synergy", ipa: "/ˈsɪn.ər.dʒi/", stressPattern: "SYN·er·gy", meaningZh: "协同效应", exampleEn: "There's real synergy between the two teams once they actually talk." },
  { id: "w_038", text: "stakeholder", ipa: "/ˈsteɪk.hoʊl.dər/", stressPattern: "STAKE·hold·er", meaningZh: "利益相关者", exampleEn: "Loop the stakeholder in before you change the spec." },
  { id: "w_039", text: "deliverable", ipa: "/dɪˈlɪv.ər.ə.bəl/", stressPattern: "de·LIV·er·a·ble", meaningZh: "交付物", exampleEn: "The deliverable for this sprint is just the design doc." },
  { id: "w_040", text: "milestone", ipa: "/ˈmaɪl.stoʊn/", stressPattern: "MILE·stone", meaningZh: "里程碑", exampleEn: "Hitting that milestone bought us another two weeks of runway." },
  { id: "w_041", text: "cadence", ipa: "/ˈkeɪ.dəns/", stressPattern: "CA·dence", meaningZh: "节奏", exampleEn: "Let's settle on a weekly cadence and stick to it." },
  { id: "w_042", text: "alignment", ipa: "/əˈlaɪn.mənt/", stressPattern: "a·LIGN·ment", meaningZh: "一致", exampleEn: "We need alignment with legal before we ship this." },
  { id: "w_043", text: "snag", ipa: "/snæɡ/", stressPattern: "SNAG", meaningZh: "小问题", exampleEn: "We hit a snag with the migration but we're back on track." },
  { id: "w_044", text: "blocker", ipa: "/ˈblɑː.kər/", stressPattern: "BLOCK·er", meaningZh: "阻塞因素", exampleEn: "Anything blocking you? Any blockers I should know about?" },
  { id: "w_045", text: "context", ipa: "/ˈkɑːn.tɛkst/", stressPattern: "CON·text", meaningZh: "背景情况", exampleEn: "Without that context, the diff doesn't really make sense." },
  { id: "w_046", text: "nuance", ipa: "/ˈnuː.ɑːns/", stressPattern: "NU·ance", meaningZh: "细微差别", exampleEn: "There's some nuance here that the chart doesn't capture." },
  { id: "w_047", text: "honestly", ipa: "/ˈɑː.nɪst.li/", stressPattern: "HON·est·ly", meaningZh: "说实话", exampleEn: "Honestly, I'd rather we punt this one to next quarter." },
  { id: "w_048", text: "literally", ipa: "/ˈlɪt.ər.ə.li/", stressPattern: "LIT·er·al·ly", meaningZh: "确实", exampleEn: "I literally just saw that ticket five minutes ago." },
  { id: "w_049", text: "essentially", ipa: "/ɪˈsɛn.ʃəl.i/", stressPattern: "es·SEN·tial·ly", meaningZh: "本质上", exampleEn: "It's essentially the same problem we hit last year." },
  { id: "w_050", text: "particularly", ipa: "/pərˈtɪk.jə.lər.li/", stressPattern: "par·TIC·u·lar·ly", meaningZh: "尤其", exampleEn: "I'm not particularly worried, but it's worth keeping an eye on." },
  { id: "w_051", text: "precisely", ipa: "/prɪˈsaɪs.li/", stressPattern: "pre·CISE·ly", meaningZh: "确切地", exampleEn: "That's precisely the part I'm not sure about." },
  { id: "w_052", text: "presumably", ipa: "/prɪˈzuː.mə.bli/", stressPattern: "pre·SUM·a·bly", meaningZh: "想必", exampleEn: "Presumably they'll push back, but let's send it anyway." },
  { id: "w_053", text: "ostensibly", ipa: "/ɑːˈstɛn.sə.bli/", stressPattern: "os·TEN·si·bly", meaningZh: "表面上", exampleEn: "He left ostensibly because of the commute, but I doubt it." },
  { id: "w_054", text: "inevitably", ipa: "/ɪˈnɛv.ɪ.tə.bli/", stressPattern: "in·EV·i·ta·bly", meaningZh: "不可避免地", exampleEn: "Inevitably, someone's going to ask why we did it this way." },
  { id: "w_055", text: "arguably", ipa: "/ˈɑːr.ɡju.ə.bli/", stressPattern: "AR·gu·a·bly", meaningZh: "可以说", exampleEn: "Arguably the cleanest solution, even if it's slower." },
  { id: "w_056", text: "absolutely", ipa: "/ˌæb.səˈluːt.li/", stressPattern: "ab·so·LUTE·ly", meaningZh: "绝对地", exampleEn: "Absolutely — let's set up time tomorrow." },
  { id: "w_057", text: "definitely", ipa: "/ˈdɛf.ə.nət.li/", stressPattern: "DEF·i·nite·ly", meaningZh: "肯定", exampleEn: "I'll definitely take a look before EOD." },
  { id: "w_058", text: "exactly", ipa: "/ɪɡˈzækt.li/", stressPattern: "ex·ACT·ly", meaningZh: "正是", exampleEn: "Yeah, exactly — that's what I was trying to say." },
  { id: "w_059", text: "scarcely", ipa: "/ˈskɛrs.li/", stressPattern: "SCARCE·ly", meaningZh: "几乎不", exampleEn: "I've scarcely had time to read the brief, let alone reply." },
  { id: "w_060", text: "hardly", ipa: "/ˈhɑːrd.li/", stressPattern: "HARD·ly", meaningZh: "几乎不", exampleEn: "That's hardly the worst thing that could've happened." },
  { id: "w_061", text: "barely", ipa: "/ˈbɛr.li/", stressPattern: "BARE·ly", meaningZh: "勉强", exampleEn: "We barely made the deadline, but we made it." },
  { id: "w_062", text: "surely", ipa: "/ˈʃʊr.li/", stressPattern: "SURE·ly", meaningZh: "肯定", exampleEn: "Surely there's a less painful way to do this." },
  { id: "w_063", text: "rarely", ipa: "/ˈrɛr.li/", stressPattern: "RARE·ly", meaningZh: "很少", exampleEn: "He rarely pushes back, so when he does, you listen." },
  { id: "w_064", text: "frustrating", ipa: "/ˈfrʌs.treɪ.tɪŋ/", stressPattern: "FRUS·trat·ing", meaningZh: "令人沮丧的", exampleEn: "It's frustrating, but the tooling really isn't there yet." },
  { id: "w_065", text: "exhausting", ipa: "/ɪɡˈzɔːs.tɪŋ/", stressPattern: "ex·HAUST·ing", meaningZh: "让人精疲力竭的", exampleEn: "Back-to-back interviews all day is exhausting." },
  { id: "w_066", text: "rewarding", ipa: "/rɪˈwɔːr.dɪŋ/", stressPattern: "re·WARD·ing", meaningZh: "有回报的", exampleEn: "Mentoring juniors is more rewarding than I expected." },
  { id: "w_067", text: "fulfilling", ipa: "/fʊlˈfɪl.ɪŋ/", stressPattern: "ful·FILL·ing", meaningZh: "充实的", exampleEn: "She left for something more fulfilling than dashboards." },
  { id: "w_068", text: "compelling", ipa: "/kəmˈpɛl.ɪŋ/", stressPattern: "com·PEL·ling", meaningZh: "引人注目的", exampleEn: "It's a compelling argument, but the numbers don't quite back it." },
  { id: "w_069", text: "underwhelming", ipa: "/ˌʌn.dərˈwɛl.mɪŋ/", stressPattern: "un·der·WHELM·ing", meaningZh: "平淡无奇的", exampleEn: "Honestly the demo was underwhelming after all that hype." },
  { id: "w_070", text: "overwhelming", ipa: "/ˌoʊ.vərˈwɛl.mɪŋ/", stressPattern: "o·ver·WHELM·ing", meaningZh: "压倒性的", exampleEn: "The volume of feedback this week has been overwhelming." },
  { id: "w_071", text: "lukewarm", ipa: "/ˌluːkˈwɔːrm/", stressPattern: "luke·WARM", meaningZh: "不冷不热的", exampleEn: "Leadership's response was lukewarm, which tells you something." },
  { id: "w_072", text: "tepid", ipa: "/ˈtɛp.ɪd/", stressPattern: "TEP·id", meaningZh: "冷淡的", exampleEn: "The team's been tepid about the whole rebrand idea." },
  { id: "w_073", text: "fervent", ipa: "/ˈfɝː.vənt/", stressPattern: "FER·vent", meaningZh: "热烈的", exampleEn: "He's a fervent believer in shipping early and often." },
  { id: "w_074", text: "iterate", ipa: "/ˈɪt.ə.reɪt/", stressPattern: "IT·er·ate", meaningZh: "迭代", exampleEn: "Let's just ship it and iterate based on real usage." },
  { id: "w_075", text: "validate", ipa: "/ˈvæl.ɪ.deɪt/", stressPattern: "VAL·i·date", meaningZh: "验证", exampleEn: "We need to validate the assumption before we go bigger." },
  { id: "w_076", text: "deprecate", ipa: "/ˈdɛp.rə.keɪt/", stressPattern: "DEP·re·cate", meaningZh: "弃用", exampleEn: "We're going to deprecate the old API by the end of Q3." },
  { id: "w_077", text: "delegate", ipa: "/ˈdɛl.ɪ.ɡeɪt/", stressPattern: "DEL·e·gate", meaningZh: "委派", exampleEn: "You should really delegate more of the review work." },
  { id: "w_078", text: "escalate", ipa: "/ˈɛs.kə.leɪt/", stressPattern: "ES·ca·late", meaningZh: "升级处理", exampleEn: "If they don't reply by tomorrow, just escalate to her manager." },
  { id: "w_079", text: "circumvent", ipa: "/ˌsɝː.kəmˈvɛnt/", stressPattern: "cir·cum·VENT", meaningZh: "绕开", exampleEn: "There's no clean way to circumvent the rate limit, sadly." },
  { id: "w_080", text: "navigate", ipa: "/ˈnæv.ɪ.ɡeɪt/", stressPattern: "NAV·i·gate", meaningZh: "驾驭", exampleEn: "She's good at navigating the politics around launches." },
  { id: "w_081", text: "consolidate", ipa: "/kənˈsɑː.lɪ.deɪt/", stressPattern: "con·SOL·i·date", meaningZh: "整合", exampleEn: "Let's consolidate the three docs into one before review." },
  { id: "w_082", text: "expedite", ipa: "/ˈɛk.spə.daɪt/", stressPattern: "EX·pe·dite", meaningZh: "加快", exampleEn: "Any way to expedite the legal review on this?" },
  { id: "w_083", text: "prioritize", ipa: "/praɪˈɔːr.ɪ.taɪz/", stressPattern: "pri·OR·i·tize", meaningZh: "优先处理", exampleEn: "We've gotta prioritize stability over new features this month." },
  { id: "w_084", text: "verbatim", ipa: "/vərˈbeɪ.tɪm/", stressPattern: "ver·BA·tim", meaningZh: "逐字地", exampleEn: "I'm not going to quote her verbatim, but that was the gist." },
  { id: "w_085", text: "caveat", ipa: "/ˈkæv.i.æt/", stressPattern: "CAV·e·at", meaningZh: "附加说明", exampleEn: "Sure, with one caveat — we don't own the data layer." },
  { id: "w_086", text: "anecdote", ipa: "/ˈæn.ɪk.doʊt/", stressPattern: "AN·ec·dote", meaningZh: "轶事", exampleEn: "That's a great anecdote, but it's not really evidence." },
  { id: "w_087", text: "anomaly", ipa: "/əˈnɑː.mə.li/", stressPattern: "a·NOM·a·ly", meaningZh: "异常情况", exampleEn: "The spike on Tuesday was an anomaly, not a trend." },
  { id: "w_088", text: "paradigm", ipa: "/ˈpɛr.ə.daɪm/", stressPattern: "PAR·a·digm", meaningZh: "范式", exampleEn: "It's a paradigm shift, but I'm not sure the team is ready." },
  { id: "w_089", text: "precedent", ipa: "/ˈprɛs.ɪ.dənt/", stressPattern: "PREC·e·dent", meaningZh: "先例", exampleEn: "We don't really have a precedent for this kind of refund." },
  { id: "w_090", text: "rationale", ipa: "/ˌræʃ.əˈnæl/", stressPattern: "ra·tion·ALE", meaningZh: "理由", exampleEn: "Walk me through the rationale before I sign off." },
  { id: "w_091", text: "tentative", ipa: "/ˈtɛn.tə.tɪv/", stressPattern: "TEN·ta·tive", meaningZh: "暂定的", exampleEn: "Let's pencil in Thursday as a tentative kickoff date." },
  { id: "w_092", text: "scope", ipa: "/skoʊp/", stressPattern: "SCOPE", meaningZh: "范围", exampleEn: "Let's not let the scope creep before the kickoff." },
  { id: "w_093", text: "tradeoff", ipa: "/ˈtreɪd.ɔːf/", stressPattern: "TRADE·off", meaningZh: "取舍", exampleEn: "There's a real tradeoff between speed and review depth." },
  { id: "w_094", text: "robust", ipa: "/roʊˈbʌst/", stressPattern: "ro·BUST", meaningZh: "健壮的", exampleEn: "The retry logic is more robust than it was last quarter." },
  { id: "w_095", text: "ambiguous", ipa: "/æmˈbɪɡ.ju.əs/", stressPattern: "am·BIG·u·ous", meaningZh: "含糊的", exampleEn: "The acceptance criteria are pretty ambiguous as written." },
  { id: "w_096", text: "transparent", ipa: "/trænˈspær.ənt/", stressPattern: "trans·PAR·ent", meaningZh: "透明", exampleEn: "I appreciated that he was transparent about the tradeoffs." },
  { id: "w_097", text: "intuitive", ipa: "/ɪnˈtuː.ə.tɪv/", stressPattern: "in·TU·i·tive", meaningZh: "直观的", exampleEn: "The flow isn't very intuitive once you leave the homepage." },
  { id: "w_098", text: "redundant", ipa: "/rɪˈdʌn.dənt/", stressPattern: "re·DUN·dant", meaningZh: "多余的", exampleEn: "These two checks are redundant — pick one." },
  { id: "w_099", text: "pragmatic", ipa: "/præɡˈmæt.ɪk/", stressPattern: "prag·MAT·ic", meaningZh: "务实的", exampleEn: "Let's take a pragmatic approach and ship the smaller version." },
  { id: "w_100", text: "schedule", ipa: "/ˈskɛdʒ.uːl/", stressPattern: "SCHED·ule", meaningZh: "日程安排", exampleEn: "I'll move things around — what's your schedule like Friday?" },
];
