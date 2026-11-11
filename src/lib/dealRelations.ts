export type RelatedRecord = Record<string, unknown>;
export type DealRelations = {schedules: RelatedRecord[] | null; commissions: RelatedRecord[] | null; documents: RelatedRecord[] | null; booth: RelatedRecord | null};

/** Omitted permissions remain unavailable; empty authorized relations remain empty. */
export function dealRelations(id: string, relations: Record<string, unknown>): DealRelations {
  const rows = (key: string) => Array.isArray(relations[key])
    ? (relations[key] as RelatedRecord[]).filter(row => String(row.deal_id) === String(id)) : null;
  return {schedules: rows('payment_schedules'), commissions: rows('commissions'), documents: rows('documents'), booth: null};
}
