// scripts/check-barcode.mjs — quick checks for src/logic/barcode.ts. Run: npm run check:barcode
// Node 24 strips TypeScript types natively, so this imports the real source file.
import { expandUpcE, isProductBarcode, ndcCandidates, normalizeUpc } from "../src/logic/barcode.ts";

let failed = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label} → ${JSON.stringify(got)}${ok ? "" : `  (expected ${JSON.stringify(want)})`}`);
}

// iOS reports UPC-A as "ean13" with 12 digits (real box read); 13 digits with a leading 0 also map to UPC-A.
check('normalizeUpc("030768031213", "ean13")', normalizeUpc("030768031213", "ean13"), "030768031213");
check('normalizeUpc("0030768031213", "ean13")', normalizeUpc("0030768031213", "ean13"), "030768031213");
check('normalizeUpc("030768031213", "upc_a")', normalizeUpc("030768031213", "upc_a"), "030768031213");
check('normalizeUpc("0305730150200", "org.gs1.EAN-13")', normalizeUpc("0305730150200", "org.gs1.EAN-13"), "305730150200");
check('normalizeUpc("4006381333931", "ean13") (non-US EAN)', normalizeUpc("4006381333931", "ean13"), null);
check('normalizeUpc("12345", "upc_a")', normalizeUpc("12345", "upc_a"), null);

// UPC-E expansion: published pairs.
check('expandUpcE("01234565")', expandUpcE("01234565"), "012345000065");
check('expandUpcE("04252614")', expandUpcE("04252614"), "042100005264");
check('expandUpcE("04963406") (Coca-Cola can)', expandUpcE("04963406"), "049000006346");
check('expandUpcE("01234566") (bad check digit)', expandUpcE("01234566"), null);

// NDC candidates for Advil 305730150200; none for a non-drug UPC.
check('ndcCandidates("305730150200")', ndcCandidates("305730150200"), ["0573-0150", "05730-150", "05730-1502"]);
check('ndcCandidates("030768031213")', ndcCandidates("030768031213"), []);

check('isProductBarcode("code128")', isProductBarcode("code128"), false);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll barcode checks passed");
process.exit(failed ? 1 : 0);
