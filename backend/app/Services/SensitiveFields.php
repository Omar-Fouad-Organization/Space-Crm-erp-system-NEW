<?php

namespace App\Services;

class SensitiveFields
{
    // Original React DTO aliases may also be preserved in ancillary attributes.
    public const FINANCIAL = ['amount', 'price', 'budget', 'base_price', 'discount_percentage', 'tax_percentage',
        'commission_percentage', 'paid_amount', 'remaining_amount', 'credit_amount', 'recovered_amount',
        'deal_value', 'value', 'total_amount', 'total_price', 'total_cost', 'additional_costs', 'commission_amount',
        'expected_value', 'negotiated_value', 'estimated_value', 'scheduled_amount', 'commission_rate',
        'contract_value', 'payment_amount', 'invoice_amount', 'base_amount', 'tax_amount', 'vat_amount',
        'unit_price', 'final_price', 'price_egp', 'sponsorship_value', 'annual_revenue', 'revenue', 'profit'];
}
