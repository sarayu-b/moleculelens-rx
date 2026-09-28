// src/logic/study.ts — Study Pack flashcards and quizzes built from the cabinet or the whole hero list
import type { Medicine, TargetLink } from "../types";
import { getHeroList, getMedicine, pickPrimary, withGene } from "./resolveMedicine";
import { firstSentences } from "./text";

export type Scope = "cabinet" | "all";
export type Flashcard = { id: string; front: string; back: string; extra?: string };
export type QuizQuestion = { id: string; question: string; options: string[]; answer: string; explanation: string };
export type Deck = { cards: Flashcard[]; usingSample: boolean };
export type Quiz = { questions: QuizQuestion[]; usingSample: boolean };

export const SAMPLE_NOTE = "Includes sample medicines";
const DEBATED_BACK = "Mechanism still debated — no single protein";
const NO_PROTEIN_BACK = "No protein — it works physically or chemically";
const MIN_CABINET_CARDS = 8;
const MIN_QUIZ = 8;
const MAX_CABINET_QUIZ = 12;
const MAX_ALL_CARDS = 40;
const MAX_ALL_QUIZ = 10;

const hasTargets = (m: Medicine) => !m.mechanismDebated && !m.noProteinMechanism && m.targets.length > 0;
const shortNames = (m: Medicine) => new Set(m.targets.map((l) => l.target.shortName));

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Keep the first item for each key (e.g. two statins both produce "What does HMG-CoA reductase normally do?").
function uniqueBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((t) => (seen.has(key(t)) ? false : (seen.add(key(t)), true)));
}

function cabinetMedicines(cabinetIds: string[]): Medicine[] {
  return cabinetIds.map(getMedicine).filter((m): m is Medicine => !!m);
}

// Top-up pool: hero-list medicines with hand-written cards and a verified target, not already used.
function sampleMedicines(exclude: Medicine[]): Medicine[] {
  const used = new Set(exclude.map((m) => m.id));
  return shuffle(getHeroList().medicines.filter((m) => m.cards && hasTargets(m) && !used.has(m.id)));
}

const allShortNames = () => [...new Set(getHeroList().medicines.flatMap((m) => m.targets.map((l) => l.target.shortName)))];

// ---------- flashcards ----------

const proteinCardBack = (link: TargetLink) => `${withGene(link.target.shortName, link.target.gene)} · ${link.mechanism}`;

// (a) protein, or (d) debated / no-protein; the protein-for-medicine card used by "All medicines".
function proteinCard(m: Medicine): Flashcard | null {
  if (m.mechanismDebated) return { id: `debated:${m.id}`, front: `Which protein does ${m.name} act on?`, back: DEBATED_BACK };
  const front = `${m.name} — which protein does it act on?`;
  if (m.noProteinMechanism) return { id: `protein:${m.id}`, front, back: NO_PROTEIN_BACK };
  const link = pickPrimary(m);
  return link ? { id: `protein:${m.id}`, front, back: proteinCardBack(link), extra: m.cards?.drug } : null;
}

function cardsFor(m: Medicine): Flashcard[] {
  const out: Flashcard[] = [];
  const a = proteinCard(m);
  if (a) out.push(a);
  const link = hasTargets(m) ? pickPrimary(m) : undefined;
  if (link) {
    // (b) what the protein normally does
    const text = m.cards?.protein ?? (link.target.functionText ? firstSentences(link.target.functionText, 2) : "");
    if (text) out.push({ id: `does:${link.target.uniprotId}`, front: `What does ${link.target.shortName} normally do?`, back: text });
  }
  // (c) what the drug changes (hand-written cards only)
  if (m.cards?.drug) out.push({ id: `changes:${m.id}`, front: `What does ${m.name} change?`, back: m.cards.drug });
  return out;
}

// Every pair of medicines that act on at least one common protein, with the shared short names.
type Pair = { a: Medicine; b: Medicine; shared: string[] };
function sharedPairs(meds: Medicine[]): Pair[] {
  const pairs: Pair[] = [];
  const withTargets = meds.filter(hasTargets);
  for (let i = 0; i < withTargets.length; i++) {
    for (let j = i + 1; j < withTargets.length; j++) {
      const a = withTargets[i];
      const b = withTargets[j];
      const bIds = new Set(b.targets.map((l) => l.target.uniprotId));
      const shared = [...new Set(a.targets.filter((l) => bIds.has(l.target.uniprotId)).map((l) => l.target.shortName))];
      if (shared.length) pairs.push({ a, b, shared });
    }
  }
  return pairs;
}

const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function pairCard(p: Pair): Flashcard {
  return { id: `pair:${p.a.id}:${p.b.id}`, front: `Which protein do ${p.a.name} and ${p.b.name} both act on?`, back: joinAnd(p.shared) };
}

export function buildDeck(cabinetIds: string[], scope: Scope = "cabinet"): Deck {
  if (scope === "all") {
    const cards = getHeroList().medicines.map(proteinCard).filter((c): c is Flashcard => !!c);
    return { cards: shuffle(cards).slice(0, MAX_ALL_CARDS), usingSample: false };
  }
  const meds = cabinetMedicines(cabinetIds);
  let cards = uniqueBy([...meds.flatMap(cardsFor), ...sharedPairs(meds).map(pairCard)], (c) => c.front);
  let usingSample = false;
  for (const m of sampleMedicines(meds)) {
    if (cards.length >= MIN_CABINET_CARDS) break;
    cards = uniqueBy([...cards, ...cardsFor(m)], (c) => c.front);
    usingSample = true;
  }
  return { cards, usingSample };
}

// ---------- quiz ----------

// Three wrong options from `pool` that are not in `correct`, plus the answer, shuffled.
function options(answer: string, pool: string[], correct: Set<string>): string[] | null {
  const wrong = shuffle([...new Set(pool)].filter((o) => !correct.has(o) && o !== answer)).slice(0, 3);
  return wrong.length === 3 ? shuffle([answer, ...wrong]) : null;
}

// Protein-for-medicine: distractors are proteins this medicine does not act on.
function proteinQuestion(m: Medicine): QuizQuestion | null {
  const link = pickPrimary(m);
  if (!link || !hasTargets(m)) return null;
  const opts = options(link.target.shortName, allShortNames(), shortNames(m));
  return opts && {
    id: `p4m:${m.id}`,
    question: `Which protein does ${m.name} act on?`,
    options: opts,
    answer: link.target.shortName,
    explanation: `${m.name}: ${proteinCardBack(link)}`,
  };
}

// Medicine-for-protein: distractors are medicines with a verified target that do NOT act on it.
// Debated medicines are never distractors (they might act on it).
function medicineQuestion(m: Medicine): QuizQuestion | null {
  const link = pickPrimary(m);
  if (!link || !hasTargets(m)) return null;
  const protein = link.target.shortName;
  const hero = getHeroList().medicines.filter(hasTargets);
  const correct = new Set(hero.filter((h) => shortNames(h).has(protein)).map((h) => h.name));
  const opts = options(m.name, hero.map((h) => h.name), correct);
  return opts && {
    id: `m4p:${link.target.uniprotId}`,
    question: `Which of these acts on ${protein}?`,
    options: opts,
    answer: m.name,
    explanation: `${m.name} acts on ${withGene(protein, link.target.gene)} · ${link.mechanism}`,
  };
}

// Shared-target pair: one shared protein is the answer; the others they share are never distractors.
function pairQuestion(p: Pair): QuizQuestion | null {
  const answer = p.shared[0];
  const opts = options(answer, allShortNames(), new Set(p.shared));
  return opts && {
    id: `pair:${p.a.id}:${p.b.id}`,
    question: `Which protein do ${p.a.name} and ${p.b.name} both act on?`,
    options: opts,
    answer,
    explanation: `They both act on ${joinAnd(p.shared)}.`,
  };
}

const questionsFor = (m: Medicine) => [proteinQuestion(m), medicineQuestion(m)];
const valid = (qs: (QuizQuestion | null)[]) => qs.filter((q): q is QuizQuestion => !!q);

export function buildQuiz(cabinetIds: string[], scope: Scope = "cabinet"): Quiz {
  if (scope === "all") {
    const qs = valid(shuffle(getHeroList().medicines).map(proteinQuestion));
    return { questions: qs.slice(0, MAX_ALL_QUIZ), usingSample: false };
  }
  const meds = cabinetMedicines(cabinetIds);
  let pool = uniqueBy(valid([...meds.flatMap(questionsFor), ...sharedPairs(meds).map(pairQuestion)]), (q) => q.question);
  let usingSample = false;
  for (const m of sampleMedicines(meds)) {
    if (pool.length >= MIN_QUIZ) break;
    pool = uniqueBy([...pool, ...valid(questionsFor(m))], (q) => q.question);
    usingSample = true;
  }
  return { questions: shuffle(pool).slice(0, Math.max(MIN_QUIZ, Math.min(pool.length, MAX_CABINET_QUIZ))), usingSample };
}

// The one sample flashcard on the locked teaser.
export function teaserCard(): Flashcard | null {
  const m = getMedicine("ibuprofen");
  return m ? proteinCard(m) : null;
}
