-- =====================================================
-- SPACE CRM Database Schema - Part 5: Tasks, Communication & Notifications
-- =====================================================

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) DEFAULT 'general' CHECK (task_type IN (
        'general', 'follow_up', 'meeting', 'call', 'email', 'proposal', 
        'contract', 'payment_follow_up', 'client_onboarding', 'event_planning'
    )),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'on_hold')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Relationships
    deal_id UUID REFERENCES public.deals_2026_01_17_19_00(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients_2026_01_17_19_00(id) ON DELETE SET NULL,
    exhibition_id UUID REFERENCES public.exhibitions_2026_01_17_19_00(id) ON DELETE SET NULL,
    parent_task_id UUID REFERENCES public.tasks_2026_01_17_19_00(id) ON DELETE SET NULL,
    
    -- Assignment
    assigned_to UUID REFERENCES public.user_profiles_2026_01_17_19_00(id) ON DELETE SET NULL,
    assigned_to_name VARCHAR(255),
    assigned_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    assigned_by_name VARCHAR(255),
    
    -- Timing
    due_date DATE,
    due_time TIME,
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    start_date DATE,
    completed_date DATE,
    
    -- Progress tracking
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    completion_notes TEXT,
    
    -- Reminders and notifications
    reminder_enabled BOOLEAN DEFAULT true,
    reminder_before_hours INTEGER DEFAULT 24,
    last_reminder_sent TIMESTAMPTZ,
    
    -- Additional fields
    tags TEXT[],
    attachments JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task comments/updates table
CREATE TABLE IF NOT EXISTS public.task_comments_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES public.tasks_2026_01_17_19_00(id) ON DELETE CASCADE,
    comment_type VARCHAR(20) DEFAULT 'comment' CHECK (comment_type IN ('comment', 'status_update', 'progress_update', 'attachment')),
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    is_internal BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_by_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    ticket_type VARCHAR(50) DEFAULT 'general' CHECK (ticket_type IN (
        'general', 'technical', 'billing', 'booth_issue', 'event_support', 
        'complaint', 'feature_request', 'bug_report'
    )),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_client', 'resolved', 'closed', 'cancelled')),
    
    -- Relationships
    client_id UUID REFERENCES public.clients_2026_01_17_19_00(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.deals_2026_01_17_19_00(id) ON DELETE SET NULL,
    exhibition_id UUID REFERENCES public.exhibitions_2026_01_17_19_00(id) ON DELETE SET NULL,
    
    -- Assignment
    assigned_to UUID REFERENCES public.user_profiles_2026_01_17_19_00(id) ON DELETE SET NULL,
    assigned_to_name VARCHAR(255),
    assigned_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    
    -- Timing
    due_date DATE,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    
    -- SLA tracking
    sla_breach BOOLEAN DEFAULT false,
    response_time_hours INTEGER,
    resolution_time_hours INTEGER,
    
    -- Client information
    client_name VARCHAR(255),
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    
    -- Additional fields
    tags TEXT[],
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    satisfaction_feedback TEXT,
    internal_notes TEXT,
    
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket responses/messages table
CREATE TABLE IF NOT EXISTS public.ticket_responses_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES public.support_tickets_2026_01_17_19_00(id) ON DELETE CASCADE,
    response_type VARCHAR(20) DEFAULT 'response' CHECK (response_type IN ('response', 'internal_note', 'status_update')),
    content TEXT NOT NULL,
    is_from_client BOOLEAN DEFAULT false,
    is_internal BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    
    -- Sender information
    sender_name VARCHAR(255),
    sender_email VARCHAR(255),
    sender_user_id UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Internal chat channels table
CREATE TABLE IF NOT EXISTS public.chat_channels_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    channel_type VARCHAR(20) DEFAULT 'team' CHECK (channel_type IN ('team', 'project', 'deal', 'client', 'general')),
    is_private BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    
    -- Relationships
    deal_id UUID REFERENCES public.deals_2026_01_17_19_00(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients_2026_01_17_19_00(id) ON DELETE SET NULL,
    exhibition_id UUID REFERENCES public.exhibitions_2026_01_17_19_00(id) ON DELETE SET NULL,
    
    -- Settings
    allow_file_sharing BOOLEAN DEFAULT true,
    allow_external_users BOOLEAN DEFAULT false,
    retention_days INTEGER DEFAULT 365,
    
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat channel members table
CREATE TABLE IF NOT EXISTS public.chat_channel_members_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES public.chat_channels_2026_01_17_19_00(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles_2026_01_17_19_00(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    is_muted BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(channel_id, user_id)
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES public.chat_channels_2026_01_17_19_00(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.user_profiles_2026_01_17_19_00(id) ON DELETE SET NULL,
    sender_name VARCHAR(255),
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image', 'system', 'reply')),
    content TEXT NOT NULL,
    reply_to_message_id UUID REFERENCES public.chat_messages_2026_01_17_19_00(id) ON DELETE SET NULL,
    attachments JSONB DEFAULT '[]',
    mentions JSONB DEFAULT '[]', -- Array of mentioned user IDs
    reactions JSONB DEFAULT '{}', -- Object with reaction counts
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles_2026_01_17_19_00(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'deal_update', 'task_assigned', 'task_due', 'payment_received', 'payment_overdue',
        'ticket_assigned', 'ticket_response', 'chat_mention', 'system_alert', 'reminder'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Relationships
    related_entity_type VARCHAR(50), -- 'deal', 'task', 'ticket', 'payment', etc.
    related_entity_id UUID,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Delivery
    delivery_method VARCHAR(20) DEFAULT 'in_app' CHECK (delivery_method IN ('in_app', 'email', 'sms', 'push')),
    delivered_at TIMESTAMPTZ,
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
    
    -- Additional data
    action_url TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles_2026_01_17_19_00(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    in_app_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    push_enabled BOOLEAN DEFAULT true,
    frequency VARCHAR(20) DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'hourly', 'daily', 'weekly', 'never')),
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, notification_type)
);

-- Automation rules table
CREATE TABLE IF NOT EXISTS public.automation_rules_2026_01_17_19_00 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
        'deal_stage_change', 'payment_received', 'payment_overdue', 'task_completed',
        'ticket_created', 'date_based', 'field_change'
    )),
    trigger_conditions JSONB NOT NULL DEFAULT '{}',
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'send_notification', 'create_task', 'send_email', 'update_field', 
        'assign_user', 'create_ticket', 'webhook'
    )),
    action_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.user_profiles_2026_01_17_19_00(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks_2026_01_17_19_00(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks_2026_01_17_19_00(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks_2026_01_17_19_00(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks_2026_01_17_19_00(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON public.tasks_2026_01_17_19_00(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks_2026_01_17_19_00(client_id);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments_2026_01_17_19_00(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON public.task_comments_2026_01_17_19_00(created_at);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets_2026_01_17_19_00(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON public.support_tickets_2026_01_17_19_00(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_client_id ON public.support_tickets_2026_01_17_19_00(client_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON public.support_tickets_2026_01_17_19_00(ticket_number);

CREATE INDEX IF NOT EXISTS idx_ticket_responses_ticket_id ON public.ticket_responses_2026_01_17_19_00(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_responses_created_at ON public.ticket_responses_2026_01_17_19_00(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_channels_type ON public.chat_channels_2026_01_17_19_00(channel_type);
CREATE INDEX IF NOT EXISTS idx_chat_channels_archived ON public.chat_channels_2026_01_17_19_00(is_archived);

CREATE INDEX IF NOT EXISTS idx_chat_channel_members_channel_id ON public.chat_channel_members_2026_01_17_19_00(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user_id ON public.chat_channel_members_2026_01_17_19_00(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON public.chat_messages_2026_01_17_19_00(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages_2026_01_17_19_00(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages_2026_01_17_19_00(sender_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications_2026_01_17_19_00(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications_2026_01_17_19_00(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications_2026_01_17_19_00(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications_2026_01_17_19_00(created_at);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences_2026_01_17_19_00(user_id);

CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON public.automation_rules_2026_01_17_19_00(is_active);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger_type ON public.automation_rules_2026_01_17_19_00(trigger_type);

-- Enable RLS
ALTER TABLE public.tasks_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_responses_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules_2026_01_17_19_00 ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view tasks assigned to them or created by them" ON public.tasks_2026_01_17_19_00
    FOR SELECT USING (
        assigned_to IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
        created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
    );

CREATE POLICY "Managers can view all tasks" ON public.tasks_2026_01_17_19_00
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can manage their own tasks" ON public.tasks_2026_01_17_19_00
    FOR ALL USING (
        assigned_to IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
        created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can view task comments for their tasks" ON public.task_comments_2026_01_17_19_00
    FOR SELECT USING (
        task_id IN (
            SELECT id FROM public.tasks_2026_01_17_19_00 
            WHERE assigned_to IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
                  created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can view support tickets they are involved in" ON public.support_tickets_2026_01_17_19_00
    FOR SELECT USING (
        assigned_to IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
        created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can view chat channels they are members of" ON public.chat_channels_2026_01_17_19_00
    FOR SELECT USING (
        id IN (
            SELECT channel_id FROM public.chat_channel_members_2026_01_17_19_00 
            WHERE user_id IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
        ) OR
        created_by IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view their own notifications" ON public.notifications_2026_01_17_19_00
    FOR SELECT USING (
        user_id IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage their own notifications" ON public.notifications_2026_01_17_19_00
    FOR ALL USING (
        user_id IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage their own notification preferences" ON public.notification_preferences_2026_01_17_19_00
    FOR ALL USING (
        user_id IN (SELECT id FROM public.user_profiles_2026_01_17_19_00 WHERE user_id = auth.uid())
    );

CREATE POLICY "Managers can view automation rules" ON public.automation_rules_2026_01_17_19_00
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles_2026_01_17_19_00 
            WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
        )
    );

-- Apply updated_at triggers
CREATE TRIGGER update_tasks_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.tasks_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_support_tickets_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.support_tickets_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_chat_channels_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.chat_channels_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_notification_preferences_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.notification_preferences_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();

CREATE TRIGGER update_automation_rules_updated_at_2026_01_17_19_00
    BEFORE UPDATE ON public.automation_rules_2026_01_17_19_00
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column_2026_01_17_19_00();