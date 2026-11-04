<?php

namespace App\Services;

class B2BMatching
{
    /** Unknown facts never satisfy a required constraint. Concierge and qualification scores are intentionally absent. */
    public function compare(array $buyer, array $exhibitor): array
    {
        $factors = []; $blockers = [];
        $common = array_values(array_intersect($buyer['categories'], $exhibitor['categories']));
        $factors['categories'] = ['points' => $common ? 35 : 0, 'matched' => $common];
        if (!$common) { $blockers[] = 'No compatible product category.'; }
        $text = mb_strtolower(implode(' ', array_map(fn ($p) => ($p['name_en'] ?? '').' '.($p['name_ar'] ?? '').' '.($p['description_en'] ?? '').' '.($p['description_ar'] ?? ''), $exhibitor['products'] ?? [])));
        $missing = array_values(array_filter($buyer['required_products'] ?? [], fn ($term) => !str_contains($text, mb_strtolower($term))));
        $factors['products'] = ['points' => $missing ? 0 : 15, 'unmet' => $missing];
        if ($missing) { $blockers[] = 'Required products are not documented.'; }
        $origins = $buyer['preferred_origins'] ?? [];
        $origin = !$origins || in_array($exhibitor['origin'] ?? null, $origins, true);
        $factors['origin'] = ['points' => $origin ? 15 : 0, 'compatible' => $origin];
        if (!$origin) { $blockers[] = 'Required origin is incompatible or unknown.'; }
        $needed = $buyer['quantity'] ?? null;
        $capacity = !$needed || (!empty($exhibitor['capacity_verified']) && !empty($exhibitor['capacity_evidence']) && ($exhibitor['capacity'] ?? 0) >= $needed && ($exhibitor['unit'] ?? '') === ($buyer['unit'] ?? ''));
        $factors['capacity'] = ['points' => $capacity ? 15 : 0, 'compatible' => $capacity, 'basis'=>$needed?'reviewed_capacity_requirement':'no_quantity_requirement'];
        if (!$capacity) { $blockers[] = 'Requested capacity is unverified or insufficient.'; }
        $certs = array_column(array_filter($exhibitor['certifications'] ?? [], fn ($c) => !empty($c['verified']) && !empty($c['evidence'])), 'name');
        $missingCerts = array_values(array_diff($buyer['required_certifications'] ?? [], $certs));
        $factors['documentation'] = ['points' => $missingCerts ? 0 : 10, 'unmet' => $missingCerts, 'basis'=>count($buyer['required_certifications']??[]) ? 'required_verified_certifications':'no_certification_requirement'];
        if ($missingCerts) { $blockers[] = 'Required certification is missing or unverified.'; }
        $availability = array_values(array_intersect($buyer['meeting_interests'] ?? [], $exhibitor['meeting_interests'] ?? []));
        $factors['preferences'] = ['points' => $availability ? 10 : 0, 'matched' => $availability];
        return ['score' => array_sum(array_column($factors, 'points')), 'factors' => $factors, 'blockers' => $blockers, 'rule_version' => '1'];
    }
}
