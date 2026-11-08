<?php

namespace App\Services;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BoothFootprintPolicy
{
    public const CODE = 'green_life_3x4_v1';

    public function projection(int $exhibition): ?array
    {
        $row = DB::table('exhibition_booth_policies')->where('exhibition_id', $exhibition)->first();
        if (!$row) {
            return null;
        }
        abort_unless($row->code === self::CODE, 503, 'Unrecognized exhibition booth policy.');

        return ['code' => self::CODE, 'min_short_m' => '3.00', 'min_long_m' => '4.00', 'min_area_sqm' => '12.00'];
    }

    public function validate(array &$data, ?object $before): void
    {
        $event = (int) $data['exhibition_id'];
        DB::table('exhibitions')->where('id', $event)->lockForUpdate()->first();
        $policy = DB::table('exhibition_booth_policies')->where('exhibition_id', $event)->lockForUpdate()->first();
        if ($policy && $policy->code !== self::CODE) {
            throw ValidationException::withMessages(['exhibition_id' => 'The exhibition booth policy requires administrator review.']);
        }
        $dimensions = [];
        $material = $before && ((int) $before->exhibition_id !== $event
            || $this->decimal($before->size_sqm) !== $this->decimal($data['size_sqm']));
        foreach (['footprint_width_m', 'footprint_depth_m'] as $key) {
            $old = $before?->$key;
            $dimensions[$key] = array_key_exists($key, $data) ? $data[$key] : $old;
            $material = $material || ($before && $this->decimal($old) !== $this->decimal($dimensions[$key]));
        }
        if ($before && $material && ($before->status !== 'available'
            || DB::table('deals')->where('booth_id', $before->id)->lockForUpdate()->first(['id']))) {
            throw ValidationException::withMessages(['size_sqm' => 'Reserved or sold booth dimensions require an authorized commercial review.']);
        }
        $legacy = $before && $policy && (int) $before->exhibition_id === $event
            && $before->id <= $policy->legacy_max_booth_id && !$before->footprint_policy_version;
        $enforce = $policy && (!$legacy || $material);
        $width = $dimensions['footprint_width_m'];
        $depth = $dimensions['footprint_depth_m'];
        if ($enforce && ($width === null || $depth === null)) {
            throw ValidationException::withMessages(['footprint_width_m' => 'Dimensions are required for a new Green Life Expo standard booth.']);
        }
        if (($width === null) !== ($depth === null)) {
            throw ValidationException::withMessages(['footprint_depth_m' => 'Provide both footprint dimensions.']);
        }
        if ($width !== null && $depth !== null) {
            $w = BigDecimal::of((string) $width);
            $d = BigDecimal::of((string) $depth);
            $area = $w->multipliedBy($d)->toScale(2, RoundingMode::HALF_UP);
            if ($enforce && (BigDecimal::min($w, $d)->isLessThan('3') || BigDecimal::max($w, $d)->isLessThan('4') || $area->isLessThan('12'))) {
                throw ValidationException::withMessages(['footprint_width_m' => 'Green Life Expo standard booths must be at least 3 × 4 meters, in either orientation.']);
            }
            if (!$area->isEqualTo((string) $data['size_sqm'])) {
                throw ValidationException::withMessages(['size_sqm' => 'Booth dimensions do not match the calculated area.']);
            }
            $data['footprint_width_m'] = (string) $w->toScale(2);
            $data['footprint_depth_m'] = (string) $d->toScale(2);
        }
        if ($enforce) {
            $data['footprint_policy_version'] = self::CODE;
        } elseif ($before && (int) $before->exhibition_id !== $event) {
            $data['footprint_policy_version'] = null;
        }
    }

    private function decimal(mixed $value): ?string
    {
        return $value === null ? null : (string) BigDecimal::of((string) $value)->toScale(2);
    }
}
