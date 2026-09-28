// src/app/study.tsx — Study Pack: flashcards and a quiz built from the cabinet or the whole hero list
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEntitlements } from "../lib/EntitlementsProvider";
import { getCabinet } from "../lib/storage";
import { buildDeck, buildQuiz, SAMPLE_NOTE, teaserCard, type Flashcard, type Quiz, type Scope } from "../logic/study";

type Mode = "flashcards" | "quiz";

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <View style={s.segment}>
      {options.map(([v, label]) => (
        <Pressable key={v} style={[s.segBtn, value === v && s.segBtnOn]} onPress={() => onChange(v)}>
          <Text style={[s.segText, value === v && s.segTextOn]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function StudyScreen() {
  const { hasStudy, loading } = useEntitlements();
  const [cabinetIds, setCabinetIds] = useState<string[] | null>(null);
  const [mode, setMode] = useState<Mode>("flashcards");
  const [scope, setScope] = useState<Scope>("cabinet");

  // Re-read on every visit so newly added medicines show up.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getCabinet().then((cab) => { if (active) setCabinetIds(cab.map((i) => i.medicineId)); });
      return () => { active = false; };
    }, [])
  );

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: "Study" }} />
      {loading || cabinetIds === null ? (
        <ActivityIndicator color="#9fb4ff" style={{ marginTop: 40 }} />
      ) : !hasStudy ? (
        <Teaser />
      ) : (
        <>
          <Segmented value={scope} options={[["cabinet", "My cabinet"], ["all", "All medicines"]]} onChange={setScope} />
          <Segmented value={mode} options={[["flashcards", "Flashcards"], ["quiz", "Quiz"]]} onChange={setMode} />
          {mode === "flashcards" ? (
            <Flashcards key={`${scope}:${cabinetIds.join(",")}`} cabinetIds={cabinetIds} scope={scope} />
          ) : (
            <QuizView key={`${scope}:${cabinetIds.join(",")}`} cabinetIds={cabinetIds} scope={scope} />
          )}
        </>
      )}
      <Text style={s.footer}>Educational only</Text>
    </ScrollView>
  );
}

function Teaser() {
  const sample = teaserCard();
  const [flipped, setFlipped] = useState(false);
  return (
    <View style={s.gap}>
      <Text style={s.h1}>Study Pack</Text>
      <Text style={s.p}>
        Flashcards and quizzes built from the medicines in your cabinet: learn which protein each one acts on.
      </Text>
      {sample && <Card card={sample} flipped={flipped} onPress={() => setFlipped((f) => !f)} />}
      <Text style={s.hint}>Tap the card to flip it</Text>
      <Pressable style={s.primaryBtn} onPress={() => router.push({ pathname: "/paywall", params: { reason: "study" } })}>
        <Text style={s.primaryText}>Unlock Study Pack</Text>
      </Pressable>
    </View>
  );
}

function Card({ card, flipped, onPress }: { card: Flashcard; flipped: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.card, flipped && s.cardBack]} onPress={onPress} accessibilityHint="Flips the card">
      {flipped ? (
        <>
          <Text style={s.cardBackText}>{card.back}</Text>
          {card.extra && <Text style={s.cardExtra}>{card.extra}</Text>}
        </>
      ) : (
        <Text style={s.cardFront}>{card.front}</Text>
      )}
    </Pressable>
  );
}

// Title for a deck or quiz, with the sample note underneath when sample medicines were mixed in.
function Heading({ title, usingSample }: { title: string; usingSample: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.h2}>{title}</Text>
      {usingSample && <Text style={s.note}>{SAMPLE_NOTE} — add yours to the cabinet</Text>}
    </View>
  );
}

function Flashcards({ cabinetIds, scope }: { cabinetIds: string[]; scope: Scope }) {
  const [deck] = useState(() => buildDeck(cabinetIds, scope));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const go = (next: number) => { setIndex(next); setFlipped(false); };
  const card = deck.cards[index];
  if (!card) return <Text style={s.p}>No flashcards yet.</Text>;

  return (
    <View style={s.gap}>
      <Heading title={scope === "all" ? "All medicines" : "My cabinet"} usingSample={deck.usingSample} />
      <Card card={card} flipped={flipped} onPress={() => setFlipped((f) => !f)} />
      <Text style={s.hint}>Tap the card to flip it</Text>
      <View style={s.navRow}>
        <Pressable style={[s.navBtn, index === 0 && s.disabled]} disabled={index === 0} onPress={() => go(index - 1)}>
          <Text style={s.navText}>← Prev</Text>
        </Pressable>
        <Text style={s.counter}>Card {index + 1} of {deck.cards.length}</Text>
        <Pressable
          style={[s.navBtn, index === deck.cards.length - 1 && s.disabled]}
          disabled={index === deck.cards.length - 1}
          onPress={() => go(index + 1)}
        >
          <Text style={s.navText}>Next →</Text>
        </Pressable>
      </View>
    </View>
  );
}

function QuizView({ cabinetIds, scope }: { cabinetIds: string[]; scope: Scope }) {
  const [quiz, setQuiz] = useState<Quiz>(() => buildQuiz(cabinetIds, scope));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  function restart() {
    setQuiz(buildQuiz(cabinetIds, scope));
    setIndex(0);
    setPicked(null);
    setScore(0);
  }

  if (!quiz.questions.length) return <Text style={s.p}>No quiz questions yet.</Text>;

  if (index >= quiz.questions.length) {
    return (
      <View style={[s.gap, { alignItems: "center" }]}>
        <Text style={s.h1}>{score} / {quiz.questions.length}</Text>
        <Text style={s.p}>{score === quiz.questions.length ? "Perfect score!" : "Nice work — try again to beat it."}</Text>
        <Pressable style={[s.primaryBtn, { alignSelf: "stretch" }]} onPress={restart}>
          <Text style={s.primaryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const q = quiz.questions[index];
  const correct = picked === q.answer;
  function pick(option: string) {
    if (picked) return;
    setPicked(option);
    if (option === q.answer) setScore((n) => n + 1);
  }

  return (
    <View style={s.gap}>
      <Heading title={scope === "all" ? "All medicines quiz" : "My cabinet quiz"} usingSample={quiz.usingSample} />
      <Text style={s.counter}>Question {index + 1} of {quiz.questions.length}</Text>
      <Text style={s.h2}>{q.question}</Text>
      {q.options.map((option) => {
        const isAnswer = option === q.answer;
        const style = picked && isAnswer ? s.optRight : picked === option ? s.optWrong : undefined;
        return (
          <Pressable key={option} style={[s.option, style]} onPress={() => pick(option)} disabled={!!picked}>
            <Text style={s.optText}>{option}</Text>
          </Pressable>
        );
      })}
      {picked && (
        <>
          <Text style={correct ? s.right : s.wrong}>
            {correct ? "✓ Correct" : "✗ Not quite"} — {q.explanation}
          </Text>
          <Pressable style={s.primaryBtn} onPress={() => { setIndex(index + 1); setPicked(null); }}>
            <Text style={s.primaryText}>{index + 1 === quiz.questions.length ? "See score" : "Next question"}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#05070f" },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  gap: { gap: 12 },
  h1: { color: "white", fontSize: 26, fontWeight: "800" },
  h2: { color: "white", fontSize: 19, fontWeight: "700" },
  p: { color: "#c7cdea", fontSize: 15, lineHeight: 21 },
  hint: { color: "#6b7599", fontSize: 13, textAlign: "center" },
  note: {
    color: "#ffd166", fontSize: 13, backgroundColor: "#2a2208", padding: 10, borderRadius: 10, overflow: "hidden",
  },
  segment: { flexDirection: "row", backgroundColor: "#111833", borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  segBtnOn: { backgroundColor: "#3b4fd1" },
  segText: { color: "#9fb4ff", fontWeight: "600" },
  segTextOn: { color: "white" },
  card: {
    minHeight: 200, backgroundColor: "#111833", borderRadius: 16, padding: 20, gap: 12,
    justifyContent: "center", borderWidth: 1, borderColor: "#22306b",
  },
  cardBack: { backgroundColor: "#16204a", borderColor: "#9fb4ff" },
  cardFront: { color: "white", fontSize: 21, fontWeight: "700", textAlign: "center" },
  cardBackText: { color: "#9fb4ff", fontSize: 19, fontWeight: "700", textAlign: "center" },
  cardExtra: { color: "#c7cdea", fontSize: 14, lineHeight: 20, textAlign: "center" },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { backgroundColor: "#22306b", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  navText: { color: "white", fontWeight: "600" },
  disabled: { opacity: 0.35 },
  counter: { color: "#9aa4c7", fontSize: 14, textAlign: "center" },
  option: { backgroundColor: "#111833", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#22306b" },
  optRight: { backgroundColor: "#113a2a", borderColor: "#3ecf8e" },
  optWrong: { backgroundColor: "#3a1520", borderColor: "#ff6b81" },
  optText: { color: "white", fontSize: 16, fontWeight: "600" },
  right: { color: "#3ecf8e", fontSize: 15, lineHeight: 21 },
  wrong: { color: "#ff9aa9", fontSize: 15, lineHeight: 21 },
  primaryBtn: { backgroundColor: "#3b4fd1", padding: 14, borderRadius: 12, alignItems: "center" },
  primaryText: { color: "white", fontWeight: "700", fontSize: 16 },
  footer: { color: "#6b7599", fontSize: 12, textAlign: "center" },
});
