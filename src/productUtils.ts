/**
 * Extracts normalized size value in milliliters or grams for smart sorting of products
 * e.g., 300ml -> 300, 2L -> 2000, 1.5L -> 1500, 2kg -> 2000
 */
export function parsePackSizeInMlOrGrams(desc: string): number | null {
  if (!desc) return null;

  // Match volume e.g., 300ml, 600ml, 1.5l, 2L, 3L
  const volumeMatch = desc.match(/(\d+(?:\.\d+)?)\s*(ml|l|liter|litres|litre)\b/i);
  if (volumeMatch) {
    const val = parseFloat(volumeMatch[1]);
    const unit = volumeMatch[2].toLowerCase();
    if (unit === 'ml') return val;
    return val * 1000; // liters to ml
  }

  // Match weight e.g., 200g, 500g, 1kg, 2kg
  const weightMatch = desc.match(/(\d+(?:\.\d+)?)\s*(g|kg|gram|grams)\b/i);
  if (weightMatch) {
    const val = parseFloat(weightMatch[1]);
    const unit = weightMatch[2].toLowerCase();
    if (unit === 'g' || unit === 'gram' || unit === 'grams') return val;
    return val * 1000; // kg to grams
  }

  return null;
}

export function formatPackSizeLabel(desc: string): string {
  if (!desc) return '';
  const match = desc.match(/(\d+(?:\.\d+)?\s*(?:ml|l|liter|g|kg)\b)/i);
  return match ? match[1].trim() : '';
}

export function compareByPackSize(aDesc: string, bDesc: string): number {
  const sizeA = parsePackSizeInMlOrGrams(aDesc);
  const sizeB = parsePackSizeInMlOrGrams(bDesc);

  if (sizeA !== null && sizeB !== null) {
    if (sizeA !== sizeB) return sizeA - sizeB;
  } else if (sizeA !== null) {
    return -1;
  } else if (sizeB !== null) {
    return 1;
  }

  return (aDesc || '').localeCompare(bDesc || '');
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
