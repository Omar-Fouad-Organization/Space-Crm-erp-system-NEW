<?php

return [
    'readiness_enabled' => env('EXHIBITOR_READINESS_ENABLED', false),
    'crm_followup_enabled' => env('B2B_CRM_FOLLOWUP_ENABLED', false),
    'onsite_enabled' => env('B2B_ONSITE_ENABLED', false),
    'enabled' => env('B2B_ENABLED', false),
    'weights' => [35, 20, 15, 10, 10, 10],
    'bands' => [80, 65],
];
