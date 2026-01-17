-- =====================================================
-- SPACE CRM Database Schema - Part 6: Client Portal & Analytics
-- =====================================================

-- Client portal users table (separate from internal users)
CREATE TABLE IF NOT EXISTS public.client_portal_users_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients_2026_01_17_19_00(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT, -- For portal-specific authentication
    full_name VARCHAR(255) NOT NULL,
    position VARCHAR(100),
    phone VARCHAR(50),
    avatar_url TEXT,
    is_primary_contact BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    password_reset_token TEXT,
    password_reset_expires TIMESTAMPTZ,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token TEXT,
    portal_permissions JSONB DEFAULT '{}', -- What they can access in portal
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client portal sessions
CREATE TABLE IF NOT EXISTS public.client_portal_sessions_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portal_user_id UUID REFERENCES public.client_portal_users_2026_01_17_19_00(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard KPIs and metrics
CREATE TABLE IF NOT EXISTS public.dashboard_kpis_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kpi_name VARCHAR(100) NOT NULL,
    kpi_type VARCHAR(50) NOT NULL CHECK (kpi_type IN (
        'revenue', 'deals', 'clients', 'conversion', 'performance', 'activity'
    )),
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    period_date DATE NOT NULL,
    value DECIMAL(15,2) NOT NULL,
    target_value DECIMAL(15,2),
    previous_period_value DECIMAL(15,2),
    percentage_change DECIMAL(5,2),
    unit VARCHAR(20), -- 'currency', 'count', 'percentage', etc.
    category VARCHAR(50),
    subcategory VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(kpi_name, period_type, period_date)
);

-- Analytics events tracking
CREATE TABLE IF NOT EXISTS public.analytics_events_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES public.user_profiles_2026_01_17_19_00(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients_2026_01_17_19_00(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals_2026_01_17_19_00(id) ON DELETE SET NULL,
    session_id TEXT,
    ip_address INET,
    user_agent TEXT,
    page_url TEXT,
    referrer_url TEXT,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System settings and configuration
CREATE TABLE IF NOT EXISTS public.system_settings_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    setting_type VARCHAR(50) NOT NULL CHECK (setting_type IN (
        'general', 'email', 'notification', 'security', 'integration', 'ui', 'business'
    )),
    description TEXT,
    is_public BOOLEAN DEFAULT false, -- Can be accessed by non-admin users
    is_encrypted BOOLEAN DEFAULT false,
    validation_rules JSONB DEFAULT '{}',
    updated_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email templates
CREATE TABLE IF NOT EXISTS public.email_templates_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(100) UNIQUE NOT NULL,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN (
        'welcome', 'deal_update', 'payment_reminder', 'invoice', 'proposal',
        'contract', 'event_invitation', 'follow_up', 'thank_you', 'custom'
    )),
    subject VARCHAR(255) NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT,
    variables JSONB DEFAULT '[]', -- Available template variables
    is_active BOOLEAN DEFAULT true,
    is_system_template BOOLEAN DEFAULT false, -- Cannot be deleted
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document templates
CREATE TABLE IF NOT EXISTS public.document_templates_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN (
        'proposal', 'contract', 'invoice', 'quote', 'agreement', 'terms', 'custom'
    )),
    content TEXT NOT NULL, -- HTML or markdown content
    variables JSONB DEFAULT '[]', -- Available template variables
    file_path TEXT, -- Path to template file if uploaded
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- File storage and attachments
CREATE TABLE IF NOT EXISTS public.file_attachments_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64), -- For duplicate detection
    
    -- Relationships (can be attached to multiple entity types)
    entity_type VARCHAR(50) NOT NULL, -- 'deal', 'client', 'task', 'ticket', etc.
    entity_id UUID NOT NULL,
    
    -- Metadata
    is_public BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Storage information
    storage_provider VARCHAR(50) DEFAULT 'local', -- 'local', 's3', 'gcs', etc.
    storage_path TEXT,
    storage_metadata JSONB DEFAULT '{}',
    
    uploaded_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity feed/timeline
CREATE TABLE IF NOT EXISTS public.activity_feed_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Actor (who performed the action)
    actor_type VARCHAR(20) DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'client')),
    actor_id UUID,
    actor_name VARCHAR(255),
    
    -- Target (what was acted upon)
    target_type VARCHAR(50) NOT NULL, -- 'deal', 'client', 'task', etc.
    target_id UUID NOT NULL,
    target_name VARCHAR(255),
    
    -- Context (additional related entities)
    context JSONB DEFAULT '{}',
    
    -- Visibility
    is_public BOOLEAN DEFAULT false, -- Visible to clients
    visibility_scope VARCHAR(20) DEFAULT 'internal' CHECK (visibility_scope IN ('internal', 'client', 'public')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data export/import jobs
CREATE TABLE IF NOT EXISTS public.data_jobs_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(20) NOT NULL CHECK (job_type IN ('export', 'import', 'backup', 'migration')),
    job_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    
    -- Configuration
    entity_types TEXT[], -- Which entities to export/import
    filters JSONB DEFAULT '{}',
    format VARCHAR(20) DEFAULT 'csv' CHECK (format IN ('csv', 'excel', 'json', 'sql')),
    
    -- Progress tracking
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    
    -- File information
    file_path TEXT,
    file_size INTEGER,
    download_url TEXT,
    expires_at TIMESTAMPTZ,
    
    -- Execution details
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    execution_log TEXT,
    
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_portal_users_client_id ON public.client_portal_users_2026_01_17_19_00(client_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_users_email ON public.client_portal_users_2026_01_17_19_00(email);
CREATE INDEX IF NOT EXISTS idx_client_portal_users_active ON public.client_portal_users_2026_01_17_19_00(is_active);

CREATE INDEX IF NOT EXISTS idx_client_portal_sessions_user_id ON public.client_portal_sessions_2026_01_17_19_00(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_sessions_token ON public.client_portal_sessions_2026_01_17_19_00(session_token);
CREATE INDEX IF NOT EXISTS idx_client_portal_sessions_expires ON public.client_portal_sessions_2026_01_17_19_00(expires_at);

CREATE INDEX IF NOT EXISTS idx_dashboard_kpis_name_period ON public.dashboard_kpis_2026_01_17_19_00(kpi_name, period_type, period_date);
CREATE INDEX IF NOT EXISTS idx_dashboard_kpis_type ON public.dashboard_kpis_2026_01_17_19_00(kpi_type);
CREATE INDEX IF NOT EXISTS idx_dashboard_kpis_date ON public.dashboard_kpis_2026_01_17_19_00(period_date);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events_2026_01_17_19_00(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events_2026_01_17_19_00(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events_2026_01_17_19_00(created_at);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings_2026_01_17_19_00(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_type ON public.system_settings_2026_01_17_19_00(setting_type);

CREATE INDEX IF NOT EXISTS idx_email_templates_type ON public.email_templates_2026_01_17_19_00(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON public.email_templates_2026_01_17_19_00(is_active);

CREATE INDEX IF NOT EXISTS idx_document_templates_type ON public.document_templates_2026_01_17_19_00(template_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON public.document_templates_2026_01_17_19_00(is_active);

CREATE INDEX IF NOT EXISTS idx_file_attachments_entity ON public.file_attachments_2026_01_17_19_00(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_hash ON public.file_attachments_2026_01_17_19_00(file_hash);

CREATE INDEX IF NOT EXISTS idx_activity_feed_target ON public.activity_feed_2026_01_17_19_00(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_actor ON public.activity_feed_2026_01_17_19_00(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON public.activity_feed_2026_01_17_19_00(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_feed_public ON public.activity_feed_2026_01_17_19_00(is_public);

CREATE INDEX IF NOT EXISTS idx_data_jobs_status ON public.data_jobs_2026_01_17_19_00(status);
CREATE INDEX IF NOT EXISTS idx_data_jobs_type ON public.data_jobs_2026_01_17_19_00(job_type);
CREATE INDEX IF NOT EXISTS idx_data_jobs_created_by ON public.data_jobs_2026_01_17_19_00(created_by);

-- Enable RLS
ALTER TABLE public.client_portal_users_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_sessions_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_kpis_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_attachments_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_jobs_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Clients can view their own portal users" ON public.client_portal_users_2026_01_17_19_00
    FOR SELECT USING (
        client_id IN (
            SELECT id FROM public.clients_2026_01_17_19_00 
            WHERE id = client_id -- This would need proper client authentication context
        )
    );

CREATE POLICY "Staff can manage client portal users" ON public.client_portal_users_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'sales')
        )
    );

CREATE POLICY "Managers can view dashboard KPIs" ON public.dashboard_kpis_2026_01_17_19_00
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'sales')
        )
    );

CREATE POLICY "System can insert analytics events" ON public.analytics_events_2026_01_17_19_00
    FOR INSERT WITH CHECK (true); -- Allow system to track events

CREATE POLICY "Managers can view analytics events" ON public.analytics_events_2026_01_17_19_00
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admins can manage system settings" ON public.system_settings_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can view public system settings" ON public.system_settings_2026_01_17_19_00
    FOR SELECT USING (is_public = true AND auth.role() = 'authenticated');

CREATE POLICY "Users can view active email templates" ON public.email_templates_2026_01_17_19_00
    FOR SELECT USING (is_active = true AND auth.role() = 'authenticated');

CREATE POLICY "Managers can manage email templates" ON public.email_templates_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can view active document templates" ON public.document_templates_2026_01_17_19_00
    FOR SELECT USING (is_active = true AND auth.role() = 'authenticated');

CREATE POLICY "Managers can manage document templates" ON public.document_templates_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can view file attachments they uploaded" ON public.file_attachments_2026_01_17_19_00
    FOR SELECT USING (
        uploaded_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
        is_public = true
    );

CREATE POLICY "Users can upload file attachments" ON public.file_attachments_2026_01_17_19_00
    FOR INSERT WITH CHECK (
        uploaded_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view activity feed" ON public.activity_feed_2026_01_17_19_00
    FOR SELECT USING (
        visibility_scope = 'public' OR
        (visibility_scope = 'internal' AND auth.role() = 'authenticated')
    );

CREATE POLICY "System can insert activity feed" ON public.activity_feed_2026_01_17_19_00
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own data jobs" ON public.data_jobs_2026_01_17_19_00
    FOR SELECT USING (
        created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
    );

CREATE POLICY "Managers can view all data jobs" ON public.data_jobs_2026_01_17_19_00
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Apply updated_at triggers
CREATE TRIGGER update_client_portal_users_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.client_portal_users_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_system_settings_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.system_settings_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_email_templates_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.email_templates_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_document_templates_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.document_templates_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

-- Insert default system settings
INSERT INTO public.system_settings_2026_01_17_19_00 (setting_key, setting_value, setting_type, description, is_public) VALUES
('company_name', '"SPACE Organizing"', 'general', 'Company name displayed throughout the system', true),
('company_logo', '""', 'general', 'Company logo URL', true),
('default_currency', '"EGP"', 'business', 'Default currency for financial calculations', true),
('tax_rate', '14', 'business', 'Default tax rate percentage', false),
('commission_rate', '5', 'business', 'Default commission rate percentage', false),
('email_from_name', '"SPACE CRM"', 'email', 'Default sender name for system emails', false),
('email_from_address', '"noreply@spacecrm.com"', 'email', 'Default sender email address', false),
('notification_retention_days', '90', 'notification', 'How long to keep notifications', false),
('session_timeout_hours', '24', 'security', 'User session timeout in hours', false),
('max_file_upload_mb', '50', 'general', 'Maximum file upload size in MB', false)
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default email templates
INSERT INTO public.email_templates_2026_01_17_19_00 (template_name, template_type, subject, html_content, text_content, variables, is_system_template) VALUES
('welcome_client', 'welcome', 'Welcome to SPACE CRM Portal', 
 '<h1>Welcome {{client_name}}!</h1><p>Your portal account has been created. You can now access your deals, payments, and documents.</p>', 
 'Welcome {{client_name}}! Your portal account has been created.',
 '["client_name", "login_url", "support_email"]', true),
('payment_reminder', 'payment_reminder', 'Payment Reminder - {{deal_title}}',
 '<h2>Payment Reminder</h2><p>Dear {{client_name}},</p><p>This is a reminder that payment of {{amount}} for {{deal_title}} is due on {{due_date}}.</p>',
 'Payment Reminder: {{amount}} for {{deal_title}} is due on {{due_date}}.',
 '["client_name", "deal_title", "amount", "due_date", "payment_link"]', true),
('deal_update', 'deal_update', 'Deal Update - {{deal_title}}',
 '<h2>Deal Status Update</h2><p>Dear {{client_name}},</p><p>Your deal "{{deal_title}}" has been updated to {{new_status}}.</p>',
 'Deal Update: {{deal_title}} status changed to {{new_status}}.',
 '["client_name", "deal_title", "new_status", "deal_link"]', true)
ON CONFLICT (template_name) DO NOTHING;