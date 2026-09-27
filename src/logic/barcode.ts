// src/logic/barcode.ts — turn a scanned box barcode into a 12-digit UPC and NDC candidates

// iOS may report EAN-13 as "org.gs1.EAN-13"; normalize to expo-camera's short names.
function normalizeType(type: string): string {
  const t = type.toLowerCase().replace(/^org\.gs1\./, "").replace(/-/g, "");
  if (t === "upca") return "upc_a";
  if (t === "upce") return "upc_e";
  return t;
}

// Returns a 12-digit UPC-A, or null if the code can't be a US drug UPC we support.
export function normalizeUpc(raw: string, type: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const t = normalizeType(type);
  if (t === "ean13") {
    // A UPC-A read as EAN-13 gets a leading 0.
    return digits.length === 13 && digits.startsWith("0") ? digits.slice(1) : null;
  }
  if (t === "upc_a") {
    if (digits.length === 12) return digits;
    if (digits.length === 13 && digits.startsWith("0")) return digits.slice(1);
    return null;
  }
  if (t === "upc_e") return null; // not supported yet
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
