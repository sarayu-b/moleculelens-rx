export type Target = {
  uniprotId: string;      // "P35354"
  name: string;           // "Prostaglandin G/H synthase 2"
  shortName: string;      // "COX-2" (UniProt short name, else gene)
  gene: string;           // "PTGS2"
  organism: string;       // "Homo sapiens"
  functionText: string;   // UniProt FUNCTION comment
};
export type Structure = {
  source: "rcsb" | "alphafold";
  fileUrl: string;        // PDB text URL
  pdbId?: string;         // "4PH9"
  ligandCode?: string;    // "IBP"
  chain?: string;         // "A"
  title?: string;         // from PDB TITLE records
  organism: string;       // from PDB SOURCE ORGANISM_SCIENTIFIC, or "Homo sapiens (predicted)"
  isAnimal: boolean;      // organism !== Homo sapiens
  resolutionA?: number;   // from REMARK 2
  note?: string;          // hand-written explanation shown under the structure line
  ligandLabel?: string;   // what the highlighted ligand is, e.g. "tagged serine" (default "drug")
};
export type TargetLink = {
  target: Target;
  actionType: string;     // ChEMBL action_type, e.g. "INHIBITOR"
  mechanism: string;      // ChEMBL mechanism_of_action, e.g. "Cyclooxygenase inhibitor"
  structure?: Structure;
};
export type Cards = { protein: string; drug: string; effect: string };
export type Medicine = {
  id: string; name: string; ingredient: string;
  rxcui?: string; chemblId?: string; brandNames: string[];
  mechanismDebated?: boolean;
  primaryTarget?: string; // UniProt accession the target screen opens on
  targets: TargetLink[];
  cards?: Cards;
  deepDives?: { sideEffects: string; metabolism: string };
};
export type HeroList = { generatedAt: string; sources: string[]; medicines: Medicine[] };
export type CabinetItem = { medicineId: string; addedAt: string };
