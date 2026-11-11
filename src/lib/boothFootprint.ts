/** Centimetre dimensions and square-centimetre multiplication; no commercial repricing. */
export function boothFootprint(width: string, depth: string) {
  const units = (value: string) => {
    if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(value)) return null;
    const [whole, fraction = ''] = value.split('.');
    const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return result > 0 ? result : null;
  };
  const w = units(width), d = units(depth);
  if (w === null || d === null) return {area: '', compliant: false, message: 'Provide both dimensions with at most two decimal places.'};
  const areaCents = Math.round(w * d / 100);
  return {area: (areaCents / 100).toFixed(2), compliant: Math.min(w, d) >= 300 && Math.max(w, d) >= 400,
    message: Math.min(w, d) >= 300 && Math.max(w, d) >= 400 ? 'Meets the 3 × 4 m standard booth minimum.' : 'Green Life Expo standard booths must be at least 3 × 4 m, in either orientation.'};
}
