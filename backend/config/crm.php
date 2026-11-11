<?php

// This whitelist drives validation, relational forms, and database migrations.
$text = fn ($label, $required = false) => ['label' => $label, 'type' => 'text', 'required' => $required];
$long = fn ($label) => ['label' => $label, 'type' => 'textarea'];
$select = fn ($label, $options, $default = null) => ['label' => $label, 'type' => 'select', 'options' => $options, 'default' => $default ?? $options[0], 'required' => true];
$ref = fn ($label, $resource, $required = false) => ['label' => $label, 'type' => 'relation', 'resource' => $resource, 'required' => $required];
$money = fn ($label, $required = false) => ['label' => $label, 'type' => 'money', 'required' => $required];
$date = fn ($label, $required = false) => ['label' => $label, 'type' => 'date', 'required' => $required];
$number = fn ($label, $required = false) => ['label' => $label, 'type' => 'number', 'required' => $required];
$resources = [
    'clients' => ['title' => 'Clients', 'section' => 'Core Operations', 'fields' => [
        'name' => $text('Company name', true), 'contact_person' => $text('Contact person', true), 'email' => ['label' => 'Email', 'type' => 'email', 'required' => true], 'phone' => $text('Phone'), 'type' => $select('Client type', ['exhibitor', 'sponsor', 'sector_sponsor']), 'status' => $select('Status', ['active', 'inactive', 'prospect', 'interested', 'not_interested']), 'industry' => $text('Industry'), 'address' => $long('Address'), 'notes' => $long('Notes')]],
    'exhibitions' => ['title' => 'Expos', 'section' => 'Core Operations', 'fields' => [
        'name' => $text('Exhibition name', true), 'start_date' => $date('Start date', true), 'end_date' => $date('End date', true), 'location' => $text('Venue / location', true), 'status' => $select('Status', ['planning', 'marketing', 'registration_open', 'active', 'completed', 'cancelled', 'postponed']), 'manager_id' => $ref('Manager', 'users'), 'budget' => $money('Budget'), 'currency' => $select('Currency', ['EGP', 'USD', 'EUR', 'SAR', 'AED']), 'description' => $long('Description')]],
    'booths' => ['title' => 'Booths', 'section' => 'Exhibition', 'fields' => [
        'name' => $text('Booth code', true), 'exhibition_id' => $ref('Exhibition', 'exhibitions', true), 'hall' => $text('Hall'), 'zone' => $text('Zone'), 'size_sqm' => ['label'=>'Area (sqm)','type'=>'decimal','required'=>true], 'footprint_width_m' => ['label'=>'Verified footprint width (m)','type'=>'decimal'], 'footprint_depth_m' => ['label'=>'Verified footprint depth (m)','type'=>'decimal'], 'price' => $money('Price', true), 'currency' => $select('Currency', ['EGP', 'USD', 'EUR', 'SAR', 'AED']), 'notes' => $long('Notes')]],
    'sponsorship_packages' => ['title' => 'Sponsorships', 'section' => 'Exhibition', 'fields' => [
        'name' => $text('Package name', true), 'exhibition_id' => $ref('Exhibition', 'exhibitions', true), 'tier' => $select('Tier', ['platinum', 'gold', 'silver', 'bronze']), 'price' => $money('Price', true), 'currency' => $select('Currency', ['EGP', 'USD', 'EUR', 'SAR', 'AED']), 'description' => $long('Benefits')]],
    'deals' => ['title' => 'Deals', 'section' => 'Core Operations', 'fields' => [
        'name' => $text('Deal title', true), 'client_id' => $ref('Client', 'clients', true), 'exhibition_id' => $ref('Exhibition', 'exhibitions', true), 'type' => $select('Deal type', ['booth', 'sponsor', 'sector_sponsor']), 'booth_id' => $ref('Booth', 'booths'), 'sponsorship_package_id' => $ref('Sponsorship package', 'sponsorship_packages'), 'salesperson_id' => $ref('Salesperson', 'users', true), 'amount' => $money('Deal amount', true), 'base_price' => $money('Base price'), 'discount_percentage' => $money('Discount %'), 'tax_percentage' => $money('Tax %'), 'currency' => $select('Currency', ['EGP', 'USD', 'EUR', 'SAR', 'AED']), 'status' => $select('Pipeline stage', ['lead_created', 'talking', 'meeting', 'strategy_proposal', 'objection_handling', 'terms_finalized', 'closed_won', 'closed_lost', 'cancelled']), 'expected_close_date' => $date('Expected close date'), 'commission_percentage' => ['label' => 'Commission %', 'type' => 'money', 'default' => '0'], 'notes' => $long('Notes')]],
    'payment_schedules' => ['title' => 'Payment schedules', 'section' => 'Financial', 'fields' => [
        'name' => $text('Installment name', true), 'deal_id' => $ref('Deal', 'deals', true), 'amount' => $money('Scheduled amount', true), 'due_date' => $date('Due date', true)]],
    'payments' => ['title' => 'Payments', 'section' => 'Financial', 'fields' => [
        'name' => $text('Payment reference', true), 'payment_schedule_id' => $ref('Installment', 'payment_schedules', true), 'amount' => $money('Received amount', true), 'paid_date' => $date('Payment date', true), 'method' => $select('Method', ['bank_transfer', 'cash', 'card', 'cheque']), 'notes' => $long('Notes')]],
    'invoices' => ['title' => 'Invoices', 'section' => 'Financial', 'fields' => [
        'name' => $text('Invoice number', true), 'deal_id' => $ref('Deal', 'deals', true), 'due_date' => $date('Due date', true), 'notes' => $long('Notes')]],
    'commissions' => ['title' => 'Commissions', 'section' => 'Financial', 'readonly_create' => true, 'fields' => [
        'name' => $text('Commission reference', true), 'deal_id' => $ref('Deal', 'deals', true), 'salesperson_id' => $ref('Salesperson', 'users', true), 'amount' => $money('Amount', true), 'status' => $select('Status', ['pending', 'approved', 'paid'])]],
    'proposals' => ['title' => 'Proposals', 'section' => 'Financial', 'fields' => [
        'name' => $text('Proposal title', true), 'deal_id' => $ref('Deal', 'deals', true), 'status' => $select('Status', ['draft', 'sent', 'accepted', 'rejected']), 'content' => $long('Proposal content')]],
    'tasks' => ['title' => 'Tasks', 'section' => 'Management', 'fields' => [
        'name' => $text('Task title', true), 'client_id' => $ref('Client', 'clients'), 'deal_id' => $ref('Deal', 'deals'), 'assigned_user_id' => $ref('Assigned to', 'users', true), 'due_date' => $date('Due date', true), 'priority' => $select('Priority', ['low', 'medium', 'high', 'urgent'], 'medium'), 'status' => $select('Status', ['pending', 'in_progress', 'completed', 'cancelled']), 'description' => $long('Description')]],
    'meetings' => ['title' => 'Meetings', 'section' => 'Management', 'fields' => [
        'name' => $text('Meeting title', true), 'client_id' => $ref('Client', 'clients'), 'deal_id' => $ref('Deal', 'deals'), 'organizer_id' => $ref('Organizer', 'users', true), 'meeting_date' => $date('Date', true), 'meeting_time' => ['label' => 'Time', 'type' => 'time', 'required' => true], 'duration' => $number('Duration (minutes)', true), 'location' => $text('Location / meeting URL'), 'status' => $select('Status', ['scheduled', 'in_progress', 'completed', 'cancelled']), 'agenda' => $long('Agenda'), 'notes' => $long('Minutes / outcome')]],
    'employees' => ['title' => 'HR & Team', 'section' => 'Management', 'fields' => [
        'name' => $text('Employee name', true), 'user_id' => $ref('User account', 'users', true), 'manager_id' => $ref('Manager', 'users'), 'department' => $text('Department', true), 'position' => $text('Position', true), 'hire_date' => $date('Hire date', true), 'salary' => $money('Salary'), 'currency' => $select('Currency', ['EGP', 'USD', 'EUR', 'SAR', 'AED']), 'status' => $select('Status', ['active', 'on_leave', 'inactive', 'terminated']), 'notes' => $long('Notes')]],
    'documents' => ['title' => 'Contracts & Documents', 'section' => 'Management', 'fields' => [
        'name' => $text('Document title', true), 'client_id' => $ref('Client', 'clients', true), 'deal_id' => $ref('Deal', 'deals'), 'type' => $select('Type', ['contract', 'proposal', 'invoice', 'other']), 'status' => $select('Status', ['draft', 'review', 'approved', 'signed', 'archived']), 'notes' => $long('Notes')]],
    'tickets' => ['title' => 'Support', 'section' => 'Management', 'fields' => [
        'name' => $text('Ticket subject', true), 'client_id' => $ref('Client', 'clients', true), 'deal_id' => $ref('Deal', 'deals'), 'assigned_user_id' => $ref('Assigned to', 'users', true), 'priority' => $select('Priority', ['low', 'medium', 'high', 'urgent'], 'medium'), 'status' => $select('Status', ['open', 'in_progress', 'resolved', 'closed']), 'description' => $long('Description'), 'resolution_notes' => $long('Resolution')]],
    'channels' => ['title' => 'Chat channels', 'section' => 'Management', 'fields' => [
        'name' => $text('Channel name', true), 'deal_id' => $ref('Related deal', 'deals')]],
    'messages' => ['title' => 'Chat messages', 'section' => 'Management', 'fields' => [
        'name' => $text('Message', true), 'channel_id' => $ref('Channel', 'channels', true)]],
    'users' => ['title' => 'User Management', 'section' => 'Management', 'fields' => [
        'name' => $text('Full name', true), 'email' => ['label' => 'Email', 'type' => 'email', 'required' => true], 'role' => $select('Role', ['super_admin', 'management', 'sales', 'finance', 'operations', 'hr', 'support']), 'status' => $select('Status', ['active', 'inactive']), 'password' => ['label' => 'Password (leave blank to keep)', 'type' => 'password']]],
];
return ['resources' => $resources];
