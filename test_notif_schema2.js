const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function test() {
  const { data: users } = await supabase.from('profiles').select('id').limit(1)
  const id = users[0].id
  const { data, error } = await supabase.from('notifications').insert({ user_id: id, actor_id: id, type: 'save' }).select()
  console.log('Result:', data, error)
}
test()
