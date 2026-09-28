// src/logic/barcode.ts — turn a scanned box barcode into a 12-digit UPC and NDC candidates

// iOS may report EAN-13 as "org.gs1.EAN-13"; normalize to expo-camera's short names.
export function normalizeType(type: string): string {
  const t = type.toLowerCase().replace(/^org\.gs1\./, "").replace(/-/g, "");
  if (t === "upca") return "upc_a";
  if (t === "upce") return "upc_e";
  return t;
}

// Only retail product barcodes are looked up; code128, QR etc. are not.
const PRODUCT_TYPES = ["upc_a", "upc_e", "ean13", "ean8"];
export function isProductBarcode(type: string): boolean {
  return PRODUCT_TYPES.includes(normalizeType(type));
}

// UPC-A check digit for the first 11 digits: 3×(odd positions) + (even positions), mod 10.
function upcCheckDigit(first11: string): string {
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += Number(first11[i]) * (i % 2 === 0 ? 3 : 1);
  return String((10 - (sum % 10)) % 10);
}

// Standard UPC-E → UPC-A expansion. Accepts 6 digits (number system 0 assumed),
// 7 (number system + body) or 8 (number system + body + check). Returns 12 digits or null.
export function expandUpcE(code: string): string | null {
  const digits = code.replace(/\D/g, "");
  let ns = "0";
  let body: string;
  let check: string | undefined;
  if (digits.length === 6) body = digits;
  else if (digits.length === 7) { ns = digits[0]; body = digits.slice(1); }
  else if (digits.length === 8) { ns = digits[0]; body = digits.slice(1, 7); check = digits[7]; }
  else return null;
  if (ns !== "0" && ns !== "1") return null; // UPC-E only exists for number systems 0 and 1

  const [d1, d2, d3, d4, d5, d6] = body;
  let manufacturer: string;
  let product: string;
  switch (d6) {
    case "0": case "1": case "2":
      manufacturer = d1 + d2 + d6 + "00"; product = "00" + d3 + d4 + d5; break;
    case "3":
      manufacturer = d1 + d2 + d3 + "00"; product = "000" + d4 + d5; break;
    case "4":
      manufacturer = d1 + d2 + d3 + d4 + "0"; product = "0000" + d5; break;
    default: // 5–9
      manufacturer = d1 + d2 + d3 + d4 + d5; product = "0000" + d6;
  }
  const first11 = ns + manufacturer + product;
  const computed = upcCheckDigit(first11);
  if (check !== undefined && check !== computed) return null; // misread
  return first11 + computed;
}

// Returns a 12-digit UPC-A, or null if the code can't be a UPC we support.
export function normalizeUpc(raw: string, type: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const t = normalizeType(type);
  if (t === "ean13" || t === "upc_a") {
    // iOS reports UPC-A as type "ean13" with only 12 digits; others add a leading 0 (13 digits).
    if (digits.length === 12) return digits;
    if (digits.length === 13 && digits.startsWith("0")) return digits.slice(1);
    return null;
  }
  if (t === "upc_e") return expandUpcE(digits);
  return null;
}

// US drug UPCs start with 3; digits 2–11 are the 10-digit NDC in one of three layouts.
export function ndcCandidates(upc12: string): string[] {
  if (upc12.length !== 12 || upc12[0] !== "3") return [];
  const d = upc12.slice(1, 11);
  return [
    `${d.slice(0, 4)}-${d.slice(4, 8)}`, // 4-4-2 → product NDC dddd-dddd
    `${d.slice(0, 5)}-${d.slice(5, 8)}`, // 5-3-2 → ddddd-ddd
    `${d.slice(0, 5)}-${d.slice(5, 9)}`, // 5-4-1 → ddddd-dddd
  ];
}
