-- =====================================================
-- SPACE CRM Database Schema - Part 1: Users & Authentication
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(50),
    department VARCHAR(100),
    position VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'sales', 'finance', 'user')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    permissions JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User sessions tracking
CREATE TABLE IF NOT EXISTS public.user_sessions_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles_2026_01_17_19_00(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    login_at TIMESTAMPTZ DEFAULT NOW(),
    logout_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log table for tracking all system changes
CREATE TABLE IF NOT EXISTS public.audit_logs_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles_2026_01_17_19_00(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles_2026_01_17_19_00(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles_2026_01_17_19_00(role);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions_2026_01_17_19_00(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs_2026_01_17_19_00(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs_2026_01_17_19_00(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs_2026_01_17_19_00(created_at);

-- RLS Policies
ALTER TABLE public.user_profiles_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON public.user_profiles_2026_01_17_19_00
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles_2026_01_17_19_00
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.user_profiles_2026_01_17_19_00
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- User sessions policies
CREATE POLICY "Users can view their own sessions" ON public.user_sessions_2026_01_17_19_00
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid()
        )
    );

-- Audit logs policies (read-only for users, full access for admins)
CREATE POLICY "Users can view audit logs for their actions" ON public.audit_logs_2026_01_17_19_00
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all audit logs" ON public.audit_logs_2026_01_17_19_00
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_2026_01_17_19_00()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles_2026_01_17_19_00 (user_id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created_2026_01_17_19_00 ON auth.users;
CREATE TRIGGER on_auth_user_created_2026_01_17_19_00
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_2026_01_17_19_00();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column_2026_01_17_19_00()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to user_profiles
CREATE TRIGGER update_user_profiles_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.user_profiles_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();