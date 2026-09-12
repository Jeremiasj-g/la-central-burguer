import { withSupabase } from 'npm:@supabase/server';

export default {
  fetch: withSupabase({ auth: 'user' }, async () => {
    return Response.json(
      { error: 'Esta función fue reemplazada por manage-access-user.' },
      { status: 410 },
    );
  }),
};
