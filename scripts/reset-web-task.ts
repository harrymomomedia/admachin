import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resetTask() {
  // Find the failed web task
  const { data: tasks } = await supabase
    .from('video_output')
    .select('id, task_id, task_status')
    .like('task_id', 'web-%')
    .eq('task_status', 'failed')
    .limit(1);

  if (tasks && tasks.length > 0) {
    const task = tasks[0];
    console.log('Resetting task:', task.id);
    
    await supabase
      .from('video_output')
      .update({ task_status: 'pending', task_error: null })
      .eq('id', task.id);
    
    console.log('Task reset to pending');
  } else {
    console.log('No failed web tasks found');
  }
  
  // Also try to create the storage bucket
  console.log('\nCreating storage bucket...');
  const { error } = await supabase.storage.createBucket('video-generator', {
    public: true
  });
  
  if (error) {
    if (error.message.includes('already exists')) {
      console.log('Bucket already exists');
    } else {
      console.log('Bucket error:', error.message);
    }
  } else {
    console.log('Bucket created successfully');
  }
}

resetTask().catch(console.error);
