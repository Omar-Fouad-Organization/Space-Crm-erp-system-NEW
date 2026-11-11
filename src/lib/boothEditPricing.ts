/** Keep the authoritative inventory total on unrelated edits, including legacy rows. */
export function boothEditPricing(booth: {price: number; size_sqm: number; additional_costs?: number}, size: string, rate: string, additional: string) {
  const originalRate = booth.size_sqm > 0 ? (booth.price - Number(booth.additional_costs || 0)) / booth.size_sqm : 0;
  const changed = Number(size) !== booth.size_sqm || Number(rate) !== originalRate || Number(additional) !== Number(booth.additional_costs || 0);
  return {originalRate, total: changed ? Number((Number(size) * Number(rate) + Number(additional)).toFixed(2)) : booth.price};
}
