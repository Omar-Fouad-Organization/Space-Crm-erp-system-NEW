-- =====================================================
-- SPACE CRM Database Schema - Part 2: Core Business Entities
-- =====================================================

-- Exhibitions/Expos table
CREATE TABLE IF NOT EXISTS public.exhibitions_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    location VARCHAR(255),
    venue_name VARCHAR(255),
    venue_address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
    total_booths INTEGER DEFAULT 0,
    available_booths INTEGER DEFAULT 0,
    total_area_sqm DECIMAL(10,2),
    booth_price_per_sqm DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'EGP',
    website_url TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    logo_url TEXT,
    banner_url TEXT,
    brochure_url TEXT,
    floor_plan_url TEXT,
    terms_conditions TEXT,
    special_requirements TEXT,
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_dates CHECK (end_date >= start_date),
    CONSTRAINT valid_booth_counts CHECK (available_booths <= total_booths)
);

-- Clients table
CREATE TABLE IF NOT EXISTS public.clients_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    mobile VARCHAR(50),
    website VARCHAR(255),
    industry VARCHAR(100),
    company_size VARCHAR(50) CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
    annual_revenue DECIMAL(15,2),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    tax_id VARCHAR(50),
    vat_number VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'prospect', 'blacklisted')),
    client_type VARCHAR(50) DEFAULT 'exhibitor' CHECK (client_type IN ('exhibitor', 'sponsor', 'visitor', 'partner')),
    credit_limit DECIMAL(15,2) DEFAULT 0,
    payment_terms INTEGER DEFAULT 30, -- days
    preferred_contact_method VARCHAR(20) DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'phone', 'whatsapp', 'sms')),
    notes TEXT,
    tags TEXT[],
    social_media JSONB DEFAULT '{}', -- LinkedIn, Twitter, etc.
    assigned_to UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client contacts table (multiple contacts per client)
CREATE TABLE IF NOT EXISTS public.client_contacts_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients_2026_01_17_19_00(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    is_decision_maker BOOLEAN DEFAULT false,
    department VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booths table
CREATE TABLE IF NOT EXISTS public.booths_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exhibition_id UUID REFERENCES public.exhibitions_2026_01_17_19_00(id) ON DELETE CASCADE,
    booth_number VARCHAR(50) NOT NULL,
    booth_code VARCHAR(50) NOT NULL,
    hall_name VARCHAR(100),
    floor_level INTEGER DEFAULT 1,
    size_sqm DECIMAL(8,2) NOT NULL,
    dimensions VARCHAR(50), -- e.g., "6x6", "3x4"
    booth_type VARCHAR(50) DEFAULT 'standard' CHECK (booth_type IN ('standard', 'premium', 'corner', 'island', 'peninsula')),
    location_category VARCHAR(50) DEFAULT 'regular' CHECK (location_category IN ('entrance', 'corner', 'regular', 'back')),
    base_price DECIMAL(12,2) NOT NULL,
    location_premium DECIMAL(12,2) DEFAULT 0,
    services_included TEXT[],
    additional_services JSONB DEFAULT '{}',
    total_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EGP',
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold', 'blocked', 'maintenance')),
    reserved_until TIMESTAMPTZ,
    floor_plan_x INTEGER, -- X coordinate on floor plan
    floor_plan_y INTEGER, -- Y coordinate on floor plan
    accessibility_features TEXT[],
    power_supply VARCHAR(50),
    internet_included BOOLEAN DEFAULT false,
    furniture_included BOOLEAN DEFAULT false,
    storage_space BOOLEAN DEFAULT false,
    special_features TEXT,
    restrictions TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(exhibition_id, booth_number),
    UNIQUE(exhibition_id, booth_code)
);

-- Sponsorship packages table
CREATE TABLE IF NOT EXISTS public.sponsorship_packages_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exhibition_id UUID REFERENCES public.exhibitions_2026_01_17_19_00(id) ON DELETE CASCADE,
    package_name VARCHAR(255) NOT NULL,
    package_tier VARCHAR(50) NOT NULL CHECK (package_tier IN ('platinum', 'gold', 'silver', 'bronze', 'title', 'presenting')),
    base_price DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EGP',
    max_sponsors INTEGER DEFAULT 1,
    current_sponsors INTEGER DEFAULT 0,
    benefits TEXT NOT NULL,
    benefits_structured JSONB DEFAULT '{}', -- Structured benefits data
    booth_included BOOLEAN DEFAULT false,
    booth_size_sqm DECIMAL(8,2),
    marketing_benefits TEXT[],
    networking_benefits TEXT[],
    branding_opportunities TEXT[],
    speaking_opportunities INTEGER DEFAULT 0,
    complimentary_passes INTEGER DEFAULT 0,
    vip_access BOOLEAN DEFAULT false,
    logo_placement TEXT[],
    website_listing BOOLEAN DEFAULT true,
    social_media_mentions INTEGER DEFAULT 0,
    email_marketing_inclusion BOOLEAN DEFAULT false,
    press_release_inclusion BOOLEAN DEFAULT false,
    post_event_report BOOLEAN DEFAULT false,
    lead_retrieval_system BOOLEAN DEFAULT false,
    custom_requirements TEXT,
    terms_conditions TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'sold_out')),
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_sponsor_count CHECK (current_sponsors <= max_sponsors)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_exhibitions_status ON public.exhibitions_2026_01_17_19_00(status);
CREATE INDEX IF NOT EXISTS idx_exhibitions_dates ON public.exhibitions_2026_01_17_19_00(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_exhibitions_location ON public.exhibitions_2026_01_17_19_00(city, country);

CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients_2026_01_17_19_00(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients_2026_01_17_19_00(status);
CREATE INDEX IF NOT EXISTS idx_clients_type ON public.clients_2026_01_17_19_00(client_type);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON public.clients_2026_01_17_19_00(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients_2026_01_17_19_00(company);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON public.client_contacts_2026_01_17_19_00(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_primary ON public.client_contacts_2026_01_17_19_00(client_id, is_primary);

CREATE INDEX IF NOT EXISTS idx_booths_exhibition_id ON public.booths_2026_01_17_19_00(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_booths_status ON public.booths_2026_01_17_19_00(status);
CREATE INDEX IF NOT EXISTS idx_booths_type ON public.booths_2026_01_17_19_00(booth_type);
CREATE INDEX IF NOT EXISTS idx_booths_size ON public.booths_2026_01_17_19_00(size_sqm);
CREATE INDEX IF NOT EXISTS idx_booths_price ON public.booths_2026_01_17_19_00(total_price);

CREATE INDEX IF NOT EXISTS idx_sponsorship_exhibition_id ON public.sponsorship_packages_2026_01_17_19_00(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_tier ON public.sponsorship_packages_2026_01_17_19_00(package_tier);
CREATE INDEX IF NOT EXISTS idx_sponsorship_status ON public.sponsorship_packages_2026_01_17_19_00(status);

-- Enable RLS
ALTER TABLE public.exhibitions_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booths_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_packages_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Authenticated users can view exhibitions" ON public.exhibitions_2026_01_17_19_00
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can manage exhibitions" ON public.exhibitions_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Authenticated users can view clients" ON public.clients_2026_01_17_19_00
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Sales team can manage clients" ON public.clients_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'sales')
        )
    );

CREATE POLICY "Users can view client contacts" ON public.client_contacts_2026_01_17_19_00
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Sales team can manage client contacts" ON public.client_contacts_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'sales')
        )
    );

CREATE POLICY "Authenticated users can view booths" ON public.booths_2026_01_17_19_00
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can manage booths" ON public.booths_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Authenticated users can view sponsorship packages" ON public.sponsorship_packages_2026_01_17_19_00
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can manage sponsorship packages" ON public.sponsorship_packages_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Apply updated_at triggers
CREATE TRIGGER update_exhibitions_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.exhibitions_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_clients_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.clients_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_client_contacts_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.client_contacts_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_booths_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.booths_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_sponsorship_packages_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.sponsorship_packages_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();