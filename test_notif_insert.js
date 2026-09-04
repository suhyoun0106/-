const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function test() {
  const { data: { session }, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'test@example.com', // I don't have user credentials
    password: 'password'
  })
}
test()
