<?php
namespace App\Services;

use Illuminate\Support\Facades\Validator;

class IntakePayload
{
    public const TYPES = ['exhibitor','sponsor','general','speaker','media','partnership','other','visitor_interest','buyer','visitor'];

    public static function hash(array $value): string
    {
        $sort = function (array $data) use (&$sort): array {
            if (! array_is_list($data)) { ksort($data); }
            foreach ($data as &$item) { if (is_array($item)) { $item = $sort($item); } }
            return $data;
        };
        return hash('sha256', json_encode($sort($value), JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
    }

    public static function validate(array $input, string $type, bool $historical = false): array
    {
        abort_unless(in_array($type,self::TYPES,true),422);
        $rules = [
            'name'=>'required|string|max:255','email'=>'required|email:rfc|max:255','phone'=>'nullable|string|max:50',
            'country_code'=>['nullable','string','regex:/^\+[0-9]{1,4}$/'],'company'=>'nullable|string|max:255',
            'country'=>'required|string|max:100','city'=>'nullable|string|max:100','language'=>'required|in:en,ar',
            'job_title'=>'nullable|string|max:255','department'=>'nullable|string|max:255','website'=>'nullable|url:http,https|max:2048',
            'message'=>'nullable|string|max:10000','classification'=>'nullable|in:importer,distributor,retailer,wholesaler,procurement,hospitality,other',
            'interests'=>'nullable|array|max:30','interests.*'=>'string|max:100','sourcing_interests'=>'nullable|string|max:4000',
            'origin_markets'=>'nullable|string|max:1000','purchasing_requirements'=>'nullable|string|max:4000',
            'supporting_information'=>'nullable|string|max:4000','visit_date'=>'nullable|date_format:Y-m-d',
            'operational_consent'=>'required|boolean','marketing_consent'=>'required|boolean','policy_version'=>'nullable|string|max:80',
            'consented_at'=>'nullable|date_format:Y-m-d\TH:i:s\Z',
        ];
        if (! $historical) {
            $rules['operational_consent']='required|accepted';
            $rules['policy_version']='required|string|max:80';
            $rules['consented_at']='required|date_format:Y-m-d\TH:i:s\Z';
        } else {
            $rules['legacy_original']='required|array';
            $rules['legacy_original.*']='nullable';
        }
        if ($type === 'buyer') {
            foreach (['company','phone','job_title','classification','sourcing_interests'] as $field) { $rules[$field]=str_replace('nullable','required',$rules[$field]); }
            $rules['interests']='required|array|min:1|max:30';
        } elseif ($type !== 'visitor') { $rules['message']='required|string|max:10000'; }
        $allowed=array_filter(array_keys($rules),fn($key)=>!str_contains($key,'.'));
        abort_if(array_diff(array_keys($input),$allowed),422,'Unknown registration field.');
        return Validator::make($input,$rules)->validate();
    }

    public static function family(string $type): string
    {
        return match($type) { 'buyer'=>'buyers', 'visitor'=>'visitors', default=>'submissions' };
    }

    public static function phone(array $payload): ?string
    {
        $phone=trim($payload['phone']??'');
        if ($phone==='') { return null; }
        $digits=preg_replace('/[^0-9]/','',$phone);
        if (str_starts_with($phone,'+')) { return '+'.$digits; }
        if (str_starts_with($phone,'00')) { return '+'.substr($digits,2); }
        // No guessed national trunk removal: original values remain authoritative.
        return ($payload['country_code']??'').$digits;
    }
}
