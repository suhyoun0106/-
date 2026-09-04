const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function test() {
  const { data: users } = await supabase.from('profiles').select('id').limit(1)
  if (!users || users.length === 0) return
  const id = users[0].id

  const { error: err1 } = await supabase.from('notifications').insert({ user_id: id, actor_id: id, type: 'save' })
  console.log('Save Error:', err1)
  
  const { error: err2 } = await supabase.from('notifications').insert({ user_id: id, actor_id: id, type: 'repost' })
  console.log('Repost Error:', err2)

  const { error: err3 } = await supabase.from('notifications').insert({ user_id: id, actor_id: id, type: 'comment' })
  console.log('Comment Error:', err3)
}
test()
