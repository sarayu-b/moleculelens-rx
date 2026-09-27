// scripts/build-hero-list.mjs
// Builds src/data/heroList.json from scripts/seed.json using free public APIs
// (ChEMBL → UniProt, RxNorm, RCSB PDB, AlphaFold DB) and writes a verification report.
// Plain Node 24, global fetch, no dependencies. Run: npm run build:hero
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_PATH = join(ROOT, "scripts", "seed.json");
const OUT_PATH = join(ROOT, "src", "data", "heroList.json");
const REPORT_PATH = join(ROOT, "scripts", "verification-report.md");

const CHEMBL = "https://www.ebi.ac.uk/chembl/api/data";
const DELAY_MS = 300;
const RETRY_MS = 2000;

// Extra names a PDB TITLE may use for a drug (besides the seed name and brand names).
const SYNONYMS = {
  acetaminophen: ["paracetamol"],
  simvastatin: ["simvastatin acid", "simvastatinic"],
};

// Hand-checked corrections applied after the UniProt / ChEMBL lookups.
const SHORT_NAME_OVERRIDES = { P10827: "TRα", P10828: "TRβ" };
const MECHANISM_OVERRIDES = { CHEMBL1464: "Vitamin K epoxide reductase inhibitor" }; // keyed by medicine chemblId

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One polite request: waits 300 ms first; retries once after 2 s on a network error or HTTP 5xx.
async function request(url, { method = "GET", as = "json" } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await sleep(DELAY_MS);
    try {
      const res = await fetch(url, { method, headers: as === "json" ? { Accept: "application/json" } : {} });
      if (res.status >= 500 && attempt === 0) { await sleep(RETRY_MS); continue; }
      if (method === "HEAD") return { status: res.status };
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return as === "json" ? await res.json() : await res.text();
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("HTTP ")) throw e;
      if (attempt === 0) { await sleep(RETRY_MS); continue; }
      throw new Error(`Network error for ${url}: ${e?.message ?? e}`);
    }
  }
  throw new Error(`Server error (5xx twice) for ${url}`);
}

// ---------- ChEMBL ----------
async function resolveChembl(seed) {
  if (seed.chemblId) {
    const m = await request(`${CHEMBL}/molecule/${seed.chemblId}.json`);
    if ((m.pref_name ?? "").toLowerCase() !== seed.name.toLowerCase()) {
      throw new Error(`ChEMBL ${seed.chemblId} pref_name "${m.pref_name}" ≠ "${seed.name}"`);
    }
    return { chemblId: m.molecule_chembl_id, prefName: m.pref_name };
  }
  const q = encodeURIComponent(seed.name.toUpperCase());
  const data = await request(`${CHEMBL}/molecule.json?pref_name__iexact=${q}&limit=5`);
  const mols = data.molecules ?? [];
  if (!mols.length) throw new Error(`No ChEMBL molecule named "${seed.name}"`);
  mols.sort((a, b) => Number(b.max_phase ?? -1) - Number(a.max_phase ?? -1));
  return { chemblId: mols[0].molecule_chembl_id, prefName: mols[0].pref_name };
}

// Some drugs (e.g. atorvastatin) have their mechanism recorded only on a salt form
// (atorvastatin calcium CHEMBL393220). If the parent has no rows, fall back to the
// same endpoint filtered by parent_molecule_chembl_id.
async function getMechanisms(chemblId) {
  const toRows = (data) => (data.mechanisms ?? [])
    .filter((m) => m.target_chembl_id)
    .map((m) => ({
      mechanism: m.mechanism_of_action ?? "",
      actionType: m.action_type ?? "",
      targetChemblId: m.target_chembl_id,
      viaMolecule: m.molecule_chembl_id,
    }));
  const direct = toRows(await request(`${CHEMBL}/mechanism.json?molecule_chembl_id=${chemblId}`));
  if (direct.length) return direct;
  return toRows(await request(`${CHEMBL}/mechanism.json?parent_molecule_chembl_id=${chemblId}`));
}

const targetCache = new Map();
async function getHumanAccessions(targetChemblId) {
  if (targetCache.has(targetChemblId)) return targetCache.get(targetChemblId);
  const t = await request(`${CHEMBL}/target/${targetChemblId}.json`);
  const accs = t.organism === "Homo sapiens"
    ? (t.target_components ?? []).filter((c) => c.component_type === "PROTEIN" && c.accession).map((c) => c.accession)
    : [];
  const result = { accessions: accs, organism: t.organism, prefName: t.pref_name };
  targetCache.set(targetChemblId, result);
  return result;
}

// ---------- UniProt ----------
const uniprotCache = new Map();
async function getUniprot(acc) {
  if (uniprotCache.has(acc)) return uniprotCache.get(acc);
  const u = await request(
    `https://rest.uniprot.org/uniprotkb/${acc}.json?fields=accession,protein_name,gene_names,cc_function,organism_name`
  );
  const rec = u.proteinDescription?.recommendedName;
  const gene = u.genes?.[0]?.geneName?.value ?? "";
  // COX-2 / COX-1 live as short names of an alternative name ("Cyclooxygenase-2" → "COX-2").
  const altShort = (u.proteinDescription?.alternativeNames ?? []).find((a) => a.shortNames?.length)?.shortNames[0].value;
  const fn = (u.comments ?? []).find((c) => c.commentType === "FUNCTION");
  const target = {
    uniprotId: acc,
    name: rec?.fullName?.value ?? acc,
    shortName: SHORT_NAME_OVERRIDES[acc] ?? rec?.shortNames?.[0]?.value ?? altShort ?? (gene || acc),
    gene,
    organism: u.organism?.scientificName ?? "",
    functionText: fn?.texts?.[0]?.value ?? "",
  };
  uniprotCache.set(acc, target);
  return target;
}

// ---------- RxNorm ----------
async function getRxcui(name) {
  const d = await request(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}`);
  return d.idGroup?.rxnormId?.[0];
}

// ---------- RCSB PDB ----------
// "MUS MUSCULUS" → "Mus musculus" (binomial style, so it compares equal to "Homo sapiens").
function speciesCase(s) {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

async function checkPdb(seed, s) {
  const fileUrl = `https://files.rcsb.org/download/${s.pdbId}.pdb`;
  const text = await request(fileUrl, { as: "text" });
  const lines = text.split(/\r?\n/);
  const flags = [];

  const ligandFound = lines.some((l) => l.startsWith("HET ") && l.trim().split(/\s+/).includes(s.ligandCode));
  if (!ligandFound) return { ok: false, flags: ["LIGAND-NOT-FOUND"] };

  const title = lines.filter((l) => l.startsWith("TITLE ")).map((l) => l.slice(10).trim()).join(" ").replace(/\s+/g, " ");
  const names = [seed.name, ...seed.brandNames, ...(SYNONYMS[seed.id] ?? [])].map((n) => n.toLowerCase());
  if (!names.some((n) => title.toLowerCase().includes(n))) flags.push("TITLE-MISMATCH");

  // Chain check: HETATM residue name is columns 18–20, chain ID is column 22 (1-based).
  const ligChains = [...new Set(lines
    .filter((l) => l.startsWith("HETATM") && l.slice(17, 20).trim() === s.ligandCode)
    .map((l) => l.charAt(21)))];
  let chain = s.chain;
  if (!ligChains.includes(chain) && ligChains.length) {
    chain = ligChains[0];
    flags.push(`CHAIN-ADJUSTED ${s.chain}→${chain}`);
  }

  let organism = "Unknown";
  const src = lines.find((l) => l.startsWith("SOURCE") && l.includes("ORGANISM_SCIENTIFIC:"));
  if (src) organism = speciesCase(src.split("ORGANISM_SCIENTIFIC:")[1].split(";")[0]);

  let resolutionA;
  const resLine = lines.find((l) => l.startsWith("REMARK   2 RESOLUTION."));
  const m = resLine?.match(/RESOLUTION\.\s+([\d.]+)/);
  if (m) resolutionA = Number(m[1]);

  return {
    ok: true,
    flags,
    structure: {
      source: "rcsb",
      fileUrl,
      pdbId: s.pdbId,
      ligandCode: s.ligandCode,
      chain,
      title,
      organism,
      isAnimal: organism !== "Homo sapiens",
      ...(resolutionA !== undefined ? { resolutionA } : {}),
      ...(s.note ? { note: s.note } : {}),
      ...(s.ligandLabel ? { ligandLabel: s.ligandLabel } : {}),
    },
  };
}

const alphafoldCache = new Map();
async function alphafoldStructure(acc) {
  if (!alphafoldCache.has(acc)) {
    const fileUrl = `https://alphafold.ebi.ac.uk/files/AF-${acc}-F1-model_v6.pdb`;
    let { status } = await request(fileUrl, { method: "HEAD" });
    if (status === 405 || status === 403) {
      // Some hosts refuse HEAD; fall back to GET.
      try { await request(fileUrl, { as: "text" }); status = 200; } catch { status = 404; }
    }
    alphafoldCache.set(acc, status === 200
      ? { source: "alphafold", fileUrl, organism: "Homo sapiens (predicted)", isAnimal: false }
      : undefined);
  }
  return alphafoldCache.get(acc);
}

// ---------- one medicine ----------
async function buildMedicine(seed, existingCards) {
  const errors = [];
  const flags = [];
  const med = {
    id: seed.id,
    name: seed.name,
    ingredient: seed.name,
    brandNames: seed.brandNames ?? [],
    targets: [],
  };
  if (seed.mechanismDebated) med.mechanismDebated = true;
  let prefName;

  // 1. ChEMBL id
  try {
    const c = await resolveChembl(seed);
    med.chemblId = c.chemblId;
    prefName = c.prefName;
  } catch (e) {
    errors.push(`ChEMBL: ${e.message}`);
    return { med: null, prefName, flags, errors };
  }

  // 2. RxNorm
  try {
    const rxcui = await getRxcui(seed.name);
    if (rxcui) med.rxcui = rxcui;
    else errors.push("RxNorm: no rxcui");
  } catch (e) { errors.push(`RxNorm: ${e.message}`); }

  // 3–6. Targets (skipped when the mechanism is debated)
  if (!seed.mechanismDebated) {
    let mechs = [];
    try { mechs = await getMechanisms(med.chemblId); } catch (e) { errors.push(`Mechanisms: ${e.message}`); }
    if (!mechs.length) errors.push("No ChEMBL mechanism rows with a target");
    const salts = [...new Set(mechs.map((m) => m.viaMolecule).filter((id) => id && id !== med.chemblId))];
    if (salts.length) flags.push(`mechanism via salt form ${salts.join(", ")}`);
    const seen = new Set();
    for (const m of mechs) {
      let t;
      try { t = await getHumanAccessions(m.targetChemblId); }
      catch (e) { errors.push(`Target ${m.targetChemblId}: ${e.message}`); continue; }
      if (t.organism !== "Homo sapiens") { errors.push(`Target ${m.targetChemblId} skipped (organism ${t.organism})`); continue; }
      for (const acc of t.accessions) {
        if (seen.has(acc)) continue;
        try {
          const target = await getUniprot(acc);
          med.targets.push({ target, actionType: m.actionType, mechanism: MECHANISM_OVERRIDES[med.chemblId] ?? m.mechanism });
          seen.add(acc);
        } catch (e) { errors.push(`UniProt ${acc}: ${e.message}`); }
      }
    }
  }

  // 7. Structures
  if (seed.structure) {
    const s = seed.structure;
    try {
      const r = await checkPdb(seed, s);
      flags.push(...r.flags.map((f) => `${s.pdbId}: ${f}`));
      if (r.ok) {
        const link = med.targets.find((l) => l.target.uniprotId === s.forTarget);
        if (link) link.structure = r.structure;
        else flags.push(`${s.pdbId}: TARGET-MISMATCH (no target ${s.forTarget})`);
      }
    } catch (e) { errors.push(`PDB ${s.pdbId}: ${e.message}`); }
  }
  for (const link of med.targets) {
    if (link.structure) continue;
    try {
      const af = await alphafoldStructure(link.target.uniprotId);
      if (af) link.structure = af;
      else flags.push(`AlphaFold 404 for ${link.target.uniprotId}`);
    } catch (e) { errors.push(`AlphaFold ${link.target.uniprotId}: ${e.message}`); }
  }

  if (seed.primaryTarget) {
    if (med.targets.some((l) => l.target.uniprotId === seed.primaryTarget)) med.primaryTarget = seed.primaryTarget;
    else flags.push(`primaryTarget ${seed.primaryTarget} not among targets (ignored)`);
  }

  if (existingCards) med.cards = existingCards;
  return { med, prefName, flags, errors };
}

// ---------- report ----------
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");

function reportRow(seed, r) {
  const med = r.med;
  const chembl = med?.chemblId ? `${med.chemblId} (${esc(r.prefName)})` : "—";
  const targets = med?.mechanismDebated
    ? "_mechanism debated — none_"
    : (med?.targets ?? []).map((l) =>
        `${l.target.uniprotId} ${esc(l.target.gene)} / ${esc(l.target.shortName)} (${esc(l.target.organism)}) — ${esc(l.mechanism)} · ${esc(l.actionType)}`
      ).join("<br>") || "—";
  const structs = (med?.targets ?? []).map((l) => {
    const s = l.structure;
    if (!s) return `${l.target.uniprotId}: none`;
    if (s.source === "alphafold") return `${l.target.uniprotId}: AlphaFold`;
    return `${l.target.uniprotId}: **${s.pdbId}** ${s.ligandCode}/${s.chain} · ${esc(s.organism)}` +
      `${s.resolutionA !== undefined ? ` · ${s.resolutionA} Å` : ""} · "${esc(s.title)}"`;
  }).join("<br>") || "—";
  const issues = [...r.flags.map((f) => `⚠️ ${esc(f)}`), ...r.errors.map((e) => `❌ ${esc(e)}`)].join("<br>") || "—";
  return `| ${seed.name} | ${chembl} | ${med?.rxcui ?? "—"} | ${targets} | ${structs} | ${issues} |`;
}

// ---------- main ----------
async function main() {
  const seeds = JSON.parse(readFileSync(SEED_PATH, "utf8"));

  // Preserve hand-written cards from a previous run, keyed by medicine id.
  const existingCards = new Map();
  if (existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(OUT_PATH, "utf8"));
      for (const m of prev.medicines ?? []) if (m.cards) existingCards.set(m.id, m.cards);
    } catch { /* unreadable previous file: start fresh */ }
  }

  const medicines = [];
  const rows = [];
  for (const seed of seeds) {
    process.stdout.write(`• ${seed.name}… `);
    let r;
    try { r = await buildMedicine(seed, existingCards.get(seed.id)); }
    catch (e) { r = { med: null, flags: [], errors: [`Unexpected: ${e.message}`] }; }
    if (r.med) medicines.push(r.med);
    rows.push(reportRow(seed, r));
    console.log(r.med ? `${r.med.targets.length} target(s)` : "SKIPPED");
  }

  const hero = {
    generatedAt: new Date().toISOString(),
    sources: [
      "ChEMBL (https://www.ebi.ac.uk/chembl/)",
      "UniProt (https://www.uniprot.org/)",
      "RxNorm (https://rxnav.nlm.nih.gov/)",
      "RCSB PDB (https://www.rcsb.org/)",
      "AlphaFold DB (https://alphafold.ebi.ac.uk/)",
    ],
    medicines,
  };
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(hero, null, 2) + "\n");

  const report = [
    "# Hero list verification report",
    "",
    `Generated ${hero.generatedAt} · ${medicines.length}/${seeds.length} medicines written to src/data/heroList.json`,
    "",
    "| Medicine | ChEMBL (pref_name) | RxCUI | Targets (accession gene / short name (organism) — mechanism · action) | Structure | Flags / errors |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  writeFileSync(REPORT_PATH, report);
  console.log("\n" + report);
}

main().catch((e) => { console.error(e); process.exit(1); });
