import { createClient } from '@supabase/supabase-js'
const supabaseUrl = 'https://kvixqfvzgoedzllpyjvu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2aXhxZnZ6Z29lZHpsbHB5anZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5ODEzNDUsImV4cCI6MjA4MzU1NzM0NX0.zPb_a0Bpa4wyXbSAqVlcmTolu3-41Ya1-e6xm0f6bSw'
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Import the supabase client like this:
// For React:
// import { supabase } from "@/integrations/supabase/client";
// For React Native:
// import { supabase } from "@/src/integrations/supabase/client";
