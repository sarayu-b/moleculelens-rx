# MoleculeLens Rx — Devpost description

## Inspiration

Almost half of Americans took a prescription drug this month (CDC). Almost nobody knows what it does inside them. Most medicines work by changing a protein, and many of those proteins have been mapped atom by atom. I wanted anyone to see that, starting from the box in their cabinet.

## What it does

Search a medicine or scan the barcode on its box. MoleculeLens shows the protein it acts on in interactive 3D, with the drug glowing in its pocket where a drug-bound structure exists. Three plain-language cards explain what the protein does, what the drug changes, and why that helps and causes side effects. Save your medicines to a cabinet: if two act on the same protein, you get a warning and a nudge to ask your pharmacist. Study mode turns your cabinet, or all 81 medicines, into flashcards and quizzes.

## How I built it

Expo SDK 57 and TypeScript in Expo Go. A generator script takes each medicine to ChEMBL for its target, UniProt for the protein's facts, and RCSB PDB for a drug-bound structure, falling back to AlphaFold. It writes a bundled hero list and a verification report I review row by row. The 3D view is 3Dmol.js inside a WebView. Barcodes go UPC → NDC → openFDA, with RxNorm as a fallback. **The AI never picks the protein.** An optional Cloudflare Worker that asks Gemini to rephrase verified facts is built and tested, but not deployed: the Gemini key needs an 18+ Google account.

## RevenueCat

Free: unlimited lookups, 3D, the cards, a 3-medicine cabinet and every safety warning. Safety is never paywalled. Lens Pro (monthly or yearly, 7-day free trial) unlocks an unlimited cabinet and side-effect and metabolism deep dives. Study Pack is a one-time purchase for flashcards and quizzes. Everything runs on RevenueCat's Test Store inside Expo Go, with my own paywall screen. Expo Go never fires the customer-info listener, so the app re-fetches entitlements after every purchase.

## Challenges

- **3D in Expo Go.** No native modules, so the viewer is 3Dmol.js in a WebView.
- **The NDC hidden in a UPC.** A US drug barcode contains a 10-digit NDC, but the digits can split three ways. The app tries all three against openFDA, then RxNorm.
- **Salt and ester forms.** ChEMBL often stores the mechanism on "atorvastatin calcium", not atorvastatin, and on fluticasone propionate rather than fluticasone. The generator follows parent links and seed overrides.
- **Honest fallbacks.** Mouse structures, debated mechanisms, germ targets, the bacterial ribosome and ingredients with no protein target each needed their own truthful screen instead of a forced answer.

## Accomplishments

- 81 medicines, each traced to a database record.
- 11 real drug-bound structures.
- Safety warnings that are free for everyone.
- A report that shows every flag instead of hiding it.

## What I learned

Biology databases disagree about names, species and even what counts as a target. Checking the data mattered more than the code.

## What's next

- Live ChEMBL lookup for any medicine.
- Reading ingredients from a label photo.
- Deploying the Worker.
- More hand-written explanations.

## Safety statement

MoleculeLens Rx is educational only. It gives no doses and no medical advice, and every warning says "Ask your pharmacist". Animal structures are labelled. Never change a medicine without asking a pharmacist or doctor.

## Built with

expo · react-native · typescript · expo-router · revenuecat · react-native-purchases · 3dmol.js · react-native-webview · expo-camera · chembl · uniprot · rcsb-pdb · alphafold · openfda · rxnorm · cloudflare-workers · gemini
