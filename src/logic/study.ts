// src/logic/study.ts — Study Pack flashcards and quizzes built from the cabinet
import type { Medicine } from "../types";
import { getHeroList, getMedicine, pickPrimary } from "./resolveMedicine";

export type Flashcard = { medicineId: string; front: string; back: string; extra?: string };
export type QuizQuestion = { medicineId: string; question: string; options: string[]; answer: string; explanation: string };
export type Deck = { cards: Flashcard[]; usingSample: boolean };
export type Quiz = { questions: QuizQuestion[]; usingSample: boolean };

export const SAMPLE_IDS = ["ibuprofen", "aspirin", "atorvastatin", "loratadine"];
export const SAMPLE_NOTE = "Using sample medicines — add yours to the cabinet";
const DEBATED_BACK = "Mechanism still debated — no single protein";
const NO_PROTEIN_BACK = "No protein — it works physically or chemically";

const hasTargets = (m: Medicine) => !m.mechanismDebated && m.targets.length > 0;

// The cabinet's medicines, or the sample set when fewer than 2 have a verified target.
function studyMedicines(cabinetIds: string[]): { meds: Medicine[]; usingSample: boolean } {
  const meds = cabinetIds.map(getMedicine).filter((m): m is Medicine => !!m);
  if (meds.filter(hasTargets).length >= 2) return { meds, usingSample: false };
  return { meds: SAMPLE_IDS.map(getMedicine).filter((m): m is Medicine => !!m), usingSample: true };
}

export function flashcardFor(m: Medicine): Flashcard | null {
  const front = `${m.name} — which protein does it act on?`;
  if (m.mechanismDebated) return { medicineId: m.id, front, back: DEBATED_BACK, extra: m.cards?.drug };
  if (m.noProteinMechanism) return { medicineId: m.id, front, back: NO_PROTEIN_BACK, extra: m.cards?.drug };
  const link = pickPrimary(m);
  if (!link) return null;
  return {
    medicineId: m.id,
    front,
    back: `${link.target.shortName} (${link.target.gene}) · ${link.mechanism}`,
    extra: m.cards?.drug,
  };
}

export function buildDeck(cabinetIds: string[]): Deck {
  const { meds, usingSample } = studyMedicines(cabinetIds);
  const cards = meds.map(flashcardFor).filter((c): c is Flashcard => !!c);
  return { cards, usingSample };
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildQuiz(cabinetIds: string[], n = 5): Quiz {
  const { meds, usingSample } = studyMedicines(cabinetIds);
  const allShortNames = [...new Set(getHeroList().medicines.flatMap((m) => m.targets.map((l) => l.target.shortName)))];
  const questions: QuizQuestion[] = [];
  for (const m of shuffle(meds.filter(hasTargets)).slice(0, n)) {
    const link = pickPrimary(m)!;
    const answer = link.target.shortName;
    // Distractors never include any of this medicine's own targets (e.g. COX-1 for ibuprofen).
    const own = new Set(m.targets.map((l) => l.target.shortName));
    const distractors = shuffle(allShortNames.filter((s) => !own.has(s))).slice(0, 3);
    questions.push({
      medicineId: m.id,
      question: `Which protein does ${m.name} act on?`,
      options: shuffle([answer, ...distractors]),
      answer,
      explanation: flashcardFor(m)!.back,
    });
  }
  return { questions, usingSample };
}
