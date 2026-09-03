const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) // ANON KEY might not have permission to delete or update other profiles!
// I need the SERVICE ROLE KEY. Let's see if it's in .env.local.
