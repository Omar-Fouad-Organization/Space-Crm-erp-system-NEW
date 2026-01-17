-- =====================================================
-- SPACE CRM Database Schema - Part 3: Deals & Sales Pipeline
-- =====================================================

-- Deals table (main sales pipeline)
CREATE TABLE IF NOT EXISTS public.deals_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    client_id UUID REFERENCES public.clients_2026_01_17_19_00(id) ON DELETE RESTRICT,
    exhibition_id UUID REFERENCES public.exhibitions_2026_01_17_19_00(id) ON DELETE SET NULL,
    booth_id UUID REFERENCES public.booths_2026_01_17_19_00(id) ON DELETE SET NULL,
    sponsorship_package_id UUID REFERENCES public.sponsorship_packages_2026_01_17_19_00(id) ON DELETE SET NULL,
    deal_type VARCHAR(50) NOT NULL CHECK (deal_type IN ('booth', 'sponsorship', 'sector_sponsor', 'expo', 'custom')),
    deal_value DECIMAL(15,2) NOT NULL,
    base_price DECIMAL(15,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_percentage DECIMAL(5,2) DEFAULT 14,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EGP',
    status VARCHAR(50) DEFAULT 'lead_created' CHECK (status IN (
        'lead_created', 'talking', 'meeting_scheduled', 'strategy', 'proposal', 
        'objection_handling', 'terms_finalized', 'closed_won', 'closed_lost', 
        'deal_failed', 'deal_canceled'
    )),
    stage VARCHAR(50) DEFAULT 'talking' CHECK (stage IN (
        'talking', 'meeting_scheduled', 'strategy_proposal', 'objection_handling',
        'terms_finalized', 'closed_won', 'closed_lost', 'canceled'
    )),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    probability INTEGER DEFAULT 10 CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    actual_close_date DATE,
    close_reason TEXT,
    win_reason TEXT,
    loss_reason TEXT,
    competitor VARCHAR(255),
    source VARCHAR(100), -- lead source
    campaign VARCHAR(255),
    health_score INTEGER DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100),
    next_action TEXT,
    next_action_date DATE,
    last_activity_date DATE,
    days_in_stage INTEGER DEFAULT 0,
    
    -- Assignment and ownership
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_by_name VARCHAR(255),
    assigned_to UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    assigned_to_name VARCHAR(255),
    
    -- Financial details
    commission_percentage DECIMAL(5,2) DEFAULT 5,
    commission_amount DECIMAL(15,2) DEFAULT 0,
    payment_plan_type VARCHAR(50) DEFAULT 'full_payment' CHECK (payment_plan_type IN ('full_payment', 'installments')),
    payment_method VARCHAR(50) DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'credit_card', 'cash', 'check')),
    installments JSONB DEFAULT '[]',
    
    -- Additional information
    notes TEXT,
    terms_conditions TEXT,
    special_requirements TEXT,
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_close_date CHECK (actual_close_date IS NULL OR actual_close_date >= created_at::date),
    CONSTRAINT valid_expected_close CHECK (expected_close_date IS NULL OR expected_close_date >= created_at::date)
);

-- Deal activities/notes table
CREATE TABLE IF NOT EXISTS public.deal_activities_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES public.deals_2026_01_17_19_00(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
        'note', 'call', 'email', 'meeting', 'proposal_sent', 'contract_sent',
        'payment_received', 'status_change', 'stage_change', 'task_completed'
    )),
    title VARCHAR(255),
    description TEXT NOT NULL,
    outcome VARCHAR(100),
    next_steps TEXT,
    duration_minutes INTEGER,
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_by_name VARCHAR(255),
    participants JSONB DEFAULT '[]', -- Array of participant objects
    attachments JSONB DEFAULT '[]', -- Array of attachment objects
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deal documents table
CREATE TABLE IF NOT EXISTS public.deal_documents_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES public.deals_2026_01_17_19_00(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'proposal', 'contract', 'invoice', 'receipt', 'floor_plan', 
        'brochure', 'presentation', 'agreement', 'other'
    )),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    version INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'approved', 'rejected')),
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    signed_by VARCHAR(255),
    expires_at TIMESTAMPTZ,
    is_template BOOLEAN DEFAULT false,
    template_variables JSONB DEFAULT '{}',
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deal competitors table
CREATE TABLE IF NOT EXISTS public.deal_competitors_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES public.deals_2026_01_17_19_00(id) ON DELETE CASCADE,
    competitor_name VARCHAR(255) NOT NULL,
    competitor_type VARCHAR(50) CHECK (competitor_type IN ('direct', 'indirect', 'substitute')),
    strengths TEXT[],
    weaknesses TEXT[],
    pricing_info TEXT,
    win_probability INTEGER CHECK (win_probability >= 0 AND win_probability <= 100),
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deal team members (multiple people can work on a deal)
CREATE TABLE IF NOT EXISTS public.deal_team_members_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES public.deals_2026_01_17_19_00(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles_2026_01_17_19_00(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'collaborator', 'observer', 'approver')),
    permissions JSONB DEFAULT '{}',
    added_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(deal_id, user_id)
);

-- Sales forecasting table
CREATE TABLE IF NOT EXISTS public.sales_forecasts_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    user_id UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    team_id UUID, -- For team forecasts
    forecasted_amount DECIMAL(15,2) NOT NULL,
    committed_amount DECIMAL(15,2) NOT NULL,
    best_case_amount DECIMAL(15,2) NOT NULL,
    worst_case_amount DECIMAL(15,2) NOT NULL,
    actual_amount DECIMAL(15,2) DEFAULT 0,
    deal_count INTEGER DEFAULT 0,
    won_deals INTEGER DEFAULT 0,
    lost_deals INTEGER DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_forecast_period CHECK (period_end > period_start),
    CONSTRAINT valid_forecast_amounts CHECK (
        best_case_amount >= committed_amount AND 
        committed_amount >= worst_case_amount
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deals_client_id ON public.deals_2026_01_17_19_00(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_exhibition_id ON public.deals_2026_01_17_19_00(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON public.deals_2026_01_17_19_00(status);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals_2026_01_17_19_00(stage);
CREATE INDEX IF NOT EXISTS idx_deals_priority ON public.deals_2026_01_17_19_00(priority);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON public.deals_2026_01_17_19_00(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_created_by ON public.deals_2026_01_17_19_00(created_by);
CREATE INDEX IF NOT EXISTS idx_deals_deal_type ON public.deals_2026_01_17_19_00(deal_type);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close ON public.deals_2026_01_17_19_00(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_deals_value ON public.deals_2026_01_17_19_00(deal_value);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON public.deals_2026_01_17_19_00(created_at);

CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_id ON public.deal_activities_2026_01_17_19_00(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_activities_type ON public.deal_activities_2026_01_17_19_00(activity_type);
CREATE INDEX IF NOT EXISTS idx_deal_activities_created_at ON public.deal_activities_2026_01_17_19_00(created_at);

CREATE INDEX IF NOT EXISTS idx_deal_documents_deal_id ON public.deal_documents_2026_01_17_19_00(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_documents_type ON public.deal_documents_2026_01_17_19_00(document_type);
CREATE INDEX IF NOT EXISTS idx_deal_documents_status ON public.deal_documents_2026_01_17_19_00(status);

CREATE INDEX IF NOT EXISTS idx_deal_competitors_deal_id ON public.deal_competitors_2026_01_17_19_00(deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_team_members_deal_id ON public.deal_team_members_2026_01_17_19_00(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_team_members_user_id ON public.deal_team_members_2026_01_17_19_00(user_id);

CREATE INDEX IF NOT EXISTS idx_sales_forecasts_period ON public.sales_forecasts_2026_01_17_19_00(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_sales_forecasts_user_id ON public.sales_forecasts_2026_01_17_19_00(user_id);

-- Enable RLS
ALTER TABLE public.deals_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_activities_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_documents_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_competitors_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_team_members_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_forecasts_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view deals they are involved in" ON public.deals_2026_01_17_19_00
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
            assigned_to IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
            id IN (SELECT deal_id FROM public.deal_team_members_2026_01_17_19_00 
                   WHERE user_id IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()))
        )
    );

CREATE POLICY "Sales team can manage deals" ON public.deals_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'sales')
        )
    );

CREATE POLICY "Users can view deal activities for their deals" ON public.deal_activities_2026_01_17_19_00
    FOR SELECT USING (
        deal_id IN (
            SELECT id FROM public.deals_2026_01_17_19_00 
            WHERE created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
                  assigned_to IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can create activities for their deals" ON public.deal_activities_2026_01_17_19_00
    FOR INSERT WITH CHECK (
        deal_id IN (
            SELECT id FROM public.deals_2026_01_17_19_00 
            WHERE created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
                  assigned_to IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can view documents for their deals" ON public.deal_documents_2026_01_17_19_00
    FOR SELECT USING (
        deal_id IN (
            SELECT id FROM public.deals_2026_01_17_19_00 
            WHERE created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
                  assigned_to IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can manage documents for their deals" ON public.deal_documents_2026_01_17_19_00
    FOR ALL USING (
        deal_id IN (
            SELECT id FROM public.deals_2026_01_17_19_00 
            WHERE created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
                  assigned_to IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can view competitors for their deals" ON public.deal_competitors_2026_01_17_19_00
    FOR SELECT USING (
        deal_id IN (
            SELECT id FROM public.deals_2026_01_17_19_00 
            WHERE created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
                  assigned_to IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can view team members for their deals" ON public.deal_team_members_2026_01_17_19_00
    FOR SELECT USING (
        deal_id IN (
            SELECT id FROM public.deals_2026_01_17_19_00 
            WHERE created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
                  assigned_to IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
        ) OR
        user_id IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view their own forecasts" ON public.sales_forecasts_2026_01_17_19_00
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
    );

CREATE POLICY "Managers can view all forecasts" ON public.sales_forecasts_2026_01_17_19_00
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Apply updated_at triggers
CREATE TRIGGER update_deals_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.deals_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_deal_documents_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.deal_documents_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_deal_competitors_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.deal_competitors_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_sales_forecasts_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.sales_forecasts_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();