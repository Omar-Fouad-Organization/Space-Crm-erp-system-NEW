-- =====================================================
-- SPACE CRM Database Schema - Part 4: Finance & Payments
-- =====================================================

-- Payment schedules table
CREATE TABLE IF NOT EXISTS public.payment_schedules_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES public.deals_2026_01_17_19_00(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients_2026_01_17_19_00(id) ON DELETE RESTRICT,
    schedule_number INTEGER NOT NULL, -- 1st payment, 2nd payment, etc.
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    percentage DECIMAL(5,2), -- percentage of total deal value
    currency VARCHAR(3) DEFAULT 'EGP',
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'overdue', 'paid', 'partially_paid', 'cancelled')),
    paid_amount DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50) CHECK (payment_method IN ('bank_transfer', 'credit_card', 'cash', 'check', 'online')),
    reference_number VARCHAR(100),
    bank_details JSONB DEFAULT '{}',
    payment_terms TEXT,
    late_fee_percentage DECIMAL(5,2) DEFAULT 0,
    late_fee_amount DECIMAL(15,2) DEFAULT 0,
    grace_period_days INTEGER DEFAULT 0,
    reminder_sent_count INTEGER DEFAULT 0,
    last_reminder_sent TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_amounts CHECK (paid_amount <= amount AND remaining_amount >= 0),
    CONSTRAINT valid_percentage CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100))
);

-- Payments table (actual payment records)
CREATE TABLE IF NOT EXISTS public.payments_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_schedule_id UUID REFERENCES public.payment_schedules_2026_01_17_19_00(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals_2026_01_17_19_00(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients_2026_01_17_19_00(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(100) UNIQUE,
    receipt_number VARCHAR(100) UNIQUE,
    payment_type VARCHAR(50) DEFAULT 'scheduled' CHECK (payment_type IN ('scheduled', 'advance', 'refund', 'adjustment')),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EGP',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    amount_in_base_currency DECIMAL(15,2),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('bank_transfer', 'credit_card', 'cash', 'check', 'online', 'wire')),
    payment_gateway VARCHAR(50), -- Stripe, PayPal, etc.
    transaction_id VARCHAR(255),
    reference_number VARCHAR(100),
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    routing_number VARCHAR(50),
    check_number VARCHAR(50),
    payment_date DATE NOT NULL,
    received_date DATE,
    cleared_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
    failure_reason TEXT,
    gateway_response JSONB DEFAULT '{}',
    fees DECIMAL(15,2) DEFAULT 0,
    net_amount DECIMAL(15,2),
    tax_amount DECIMAL(15,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 0,
    description TEXT,
    attachments JSONB DEFAULT '[]', -- Array of attachment objects
    processed_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    verified_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    verified_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    deal_id UUID REFERENCES public.deals_2026_01_17_19_00(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients_2026_01_17_19_00(id) ON DELETE RESTRICT,
    invoice_type VARCHAR(50) DEFAULT 'standard' CHECK (invoice_type IN ('standard', 'proforma', 'credit_note', 'debit_note')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    payment_terms INTEGER DEFAULT 30, -- days
    subtotal DECIMAL(15,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 14,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EGP',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    
    -- Client billing information
    bill_to_name VARCHAR(255) NOT NULL,
    bill_to_company VARCHAR(255),
    bill_to_address TEXT,
    bill_to_city VARCHAR(100),
    bill_to_country VARCHAR(100),
    bill_to_postal_code VARCHAR(20),
    bill_to_tax_id VARCHAR(50),
    bill_to_vat_number VARCHAR(50),
    
    -- Company information
    company_name VARCHAR(255) NOT NULL,
    company_address TEXT,
    company_tax_id VARCHAR(50),
    company_vat_number VARCHAR(50),
    
    -- Invoice content
    line_items JSONB NOT NULL DEFAULT '[]', -- Array of line item objects
    notes TEXT,
    terms_conditions TEXT,
    footer_text TEXT,
    
    -- File management
    pdf_path TEXT,
    pdf_generated_at TIMESTAMPTZ,
    
    -- Tracking
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    first_payment_at TIMESTAMPTZ,
    fully_paid_at TIMESTAMPTZ,
    
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_invoice_dates CHECK (due_date >= issue_date),
    CONSTRAINT valid_invoice_amounts CHECK (
        paid_amount <= total_amount AND 
        remaining_amount >= 0 AND
        paid_amount + remaining_amount = total_amount
    )
);

-- Commission schedules table
CREATE TABLE IF NOT EXISTS public.commission_schedules_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES public.deals_2026_01_17_19_00(id) ON DELETE CASCADE,
    payment_schedule_id UUID REFERENCES public.payment_schedules_2026_01_17_19_00(id) ON DELETE CASCADE,
    sales_person_id UUID REFERENCES public.user_profiles_2026_01_17_19_00(id) ON DELETE RESTRICT,
    sales_person_name VARCHAR(255) NOT NULL,
    commission_type VARCHAR(50) DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed', 'tiered')),
    commission_percentage DECIMAL(5,2),
    commission_amount DECIMAL(15,2) NOT NULL,
    base_amount DECIMAL(15,2) NOT NULL, -- Amount commission is calculated on
    currency VARCHAR(3) DEFAULT 'EGP',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled', 'disputed')),
    due_date DATE,
    payment_trigger VARCHAR(50) DEFAULT 'payment_received' CHECK (payment_trigger IN ('deal_closed', 'payment_received', 'manual')),
    tier_level INTEGER, -- For tiered commissions
    split_percentage DECIMAL(5,2), -- For split commissions
    team_commission BOOLEAN DEFAULT false,
    manager_override BOOLEAN DEFAULT false,
    override_reason TEXT,
    notes TEXT,
    approved_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    approved_at TIMESTAMPTZ,
    paid_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(100),
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Commission payments table
CREATE TABLE IF NOT EXISTS public.commission_payments_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commission_schedule_id UUID REFERENCES public.commission_schedules_2026_01_17_19_00(id) ON DELETE CASCADE,
    sales_person_id UUID REFERENCES public.user_profiles_2026_01_17_19_00(id) ON DELETE RESTRICT,
    payment_batch_id UUID, -- For batch payments
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EGP',
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('bank_transfer', 'check', 'cash', 'payroll')),
    payment_date DATE NOT NULL,
    reference_number VARCHAR(100),
    bank_details JSONB DEFAULT '{}',
    tax_deducted DECIMAL(15,2) DEFAULT 0,
    net_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    failure_reason TEXT,
    notes TEXT,
    processed_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial reports table
CREATE TABLE IF NOT EXISTS public.financial_reports_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
        'revenue', 'payments', 'commissions', 'outstanding', 'profit_loss', 'cash_flow'
    )),
    report_name VARCHAR(255) NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    filters JSONB DEFAULT '{}',
    data JSONB NOT NULL,
    summary JSONB DEFAULT '{}',
    file_path TEXT,
    file_format VARCHAR(10) CHECK (file_format IN ('pdf', 'excel', 'csv')),
    generated_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_scheduled BOOLEAN DEFAULT false,
    schedule_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_schedules_deal_id ON public.payment_schedules_2026_01_17_19_00(deal_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_client_id ON public.payment_schedules_2026_01_17_19_00(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_status ON public.payment_schedules_2026_01_17_19_00(status);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_due_date ON public.payment_schedules_2026_01_17_19_00(due_date);

CREATE INDEX IF NOT EXISTS idx_payments_deal_id ON public.payments_2026_01_17_19_00(deal_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments_2026_01_17_19_00(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments_2026_01_17_19_00(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments_2026_01_17_19_00(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_number ON public.payments_2026_01_17_19_00(invoice_number);

CREATE INDEX IF NOT EXISTS idx_invoices_deal_id ON public.invoices_2026_01_17_19_00(deal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices_2026_01_17_19_00(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices_2026_01_17_19_00(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices_2026_01_17_19_00(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices_2026_01_17_19_00(invoice_number);

CREATE INDEX IF NOT EXISTS idx_commission_schedules_deal_id ON public.commission_schedules_2026_01_17_19_00(deal_id);
CREATE INDEX IF NOT EXISTS idx_commission_schedules_sales_person ON public.commission_schedules_2026_01_17_19_00(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_commission_schedules_status ON public.commission_schedules_2026_01_17_19_00(status);
CREATE INDEX IF NOT EXISTS idx_commission_schedules_due_date ON public.commission_schedules_2026_01_17_19_00(due_date);

CREATE INDEX IF NOT EXISTS idx_commission_payments_schedule_id ON public.commission_payments_2026_01_17_19_00(commission_schedule_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_sales_person ON public.commission_payments_2026_01_17_19_00(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_date ON public.commission_payments_2026_01_17_19_00(payment_date);

CREATE INDEX IF NOT EXISTS idx_financial_reports_type ON public.financial_reports_2026_01_17_19_00(report_type);
CREATE INDEX IF NOT EXISTS idx_financial_reports_period ON public.financial_reports_2026_01_17_19_00(period_start, period_end);

-- Enable RLS
ALTER TABLE public.payment_schedules_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_schedules_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_reports_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Finance team can view all payment schedules" ON public.payment_schedules_2026_01_17_19_00
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'finance')
        )
    );

CREATE POLICY "Sales team can view payment schedules for their deals" ON public.payment_schedules_2026_01_17_19_00
    FOR SELECT USING (
        deal_id IN (
            SELECT id FROM public.deals_2026_01_17_19_00 
            WHERE created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
                  assigned_to IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Finance team can manage payments" ON public.payments_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'finance')
        )
    );

CREATE POLICY "Finance team can manage invoices" ON public.invoices_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'finance')
        )
    );

CREATE POLICY "Users can view their own commission schedules" ON public.commission_schedules_2026_01_17_19_00
    FOR SELECT USING (
        sales_person_id IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
    );

CREATE POLICY "Managers can view all commission schedules" ON public.commission_schedules_2026_01_17_19_00
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'finance')
        )
    );

CREATE POLICY "Users can view their own commission payments" ON public.commission_payments_2026_01_17_19_00
    FOR SELECT USING (
        sales_person_id IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
    );

CREATE POLICY "Finance team can manage commission payments" ON public.commission_payments_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'finance')
        )
    );

CREATE POLICY "Managers can view financial reports" ON public.financial_reports_2026_01_17_19_00
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'finance')
        )
    );

-- Apply updated_at triggers
CREATE TRIGGER update_payment_schedules_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.payment_schedules_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_payments_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.payments_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_invoices_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.invoices_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_commission_schedules_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.commission_schedules_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_commission_payments_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.commission_payments_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();