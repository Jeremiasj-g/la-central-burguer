import { withSupabase } from 'npm:@supabase/server';

const json = (body: unknown, status = 200) => Response.json(body, { status });

function requiredText(value: unknown, field: string, min = 1) {
  const text = String(value ?? '').trim();
  if (text.length < min) throw new Error(`${field} es obligatorio.`);
  return text;
}

function optionalText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function commissionValue(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw new Error('La comisión debe estar entre 0 y 100.');
  return Math.round(parsed * 100) / 100;
}

const vehicleTypes = new Set(['moto', 'auto', 'bici', 'otro']);

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response('ok');
    if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

    const actorId = ctx.userClaims?.sub;
    if (!actorId) return json({ error: 'Sesión inválida.' }, 401);

    const { data: actorProfile } = await ctx.supabaseAdmin.from('profiles').select('role,active').eq('id', actorId).maybeSingle();
    if (!actorProfile || actorProfile.role !== 'admin' || !actorProfile.active) return json({ error: 'No autorizado.' }, 403);

    try {
      const body = await req.json();
      const action = String(body?.action ?? '');

      if (action === 'create') {
        const fullName = requiredText(body.fullName, 'Nombre', 2);
        const email = requiredText(body.email, 'Email', 5).toLowerCase();
        const password = requiredText(body.password, 'Contraseña', 8);
        const phone = optionalText(body.phone);
        const vehicleType = String(body.vehicleType ?? 'moto');
        const commissionPercent = commissionValue(body.commissionPercent);
        if (!vehicleTypes.has(vehicleType)) throw new Error('Tipo de vehículo inválido.');

        let createdUserId: string | null = null;
        try {
          const { data: created, error: createError } = await ctx.supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          });
          if (createError || !created.user) throw new Error(createError?.message ?? 'No se pudo crear el usuario.');
          createdUserId = created.user.id;

          const { error: profileError } = await ctx.supabaseAdmin.from('profiles').update({ full_name: fullName, role: 'delivery', active: true }).eq('id', createdUserId);
          if (profileError) throw profileError;
          const { error: driverError } = await ctx.supabaseAdmin.from('delivery_drivers').insert({ profile_id: createdUserId, phone, vehicle_type: vehicleType, active: true });
          if (driverError) throw driverError;
          const { error: rateError } = await ctx.supabaseAdmin.from('delivery_driver_rates').insert({ driver_id: createdUserId, commission_percent: commissionPercent, created_by: actorId });
          if (rateError) throw rateError;
          return json({ ok: true, driverId: createdUserId });
        } catch (error) {
          if (createdUserId) await ctx.supabaseAdmin.auth.admin.deleteUser(createdUserId);
          throw error;
        }
      }

      if (action === 'update') {
        const driverId = requiredText(body.driverId, 'Repartidor');
        const fullName = requiredText(body.fullName, 'Nombre', 2);
        const email = requiredText(body.email, 'Email', 5).toLowerCase();
        const phone = optionalText(body.phone);
        const vehicleType = String(body.vehicleType ?? 'moto');
        const commissionPercent = commissionValue(body.commissionPercent);
        if (!vehicleTypes.has(vehicleType)) throw new Error('Tipo de vehículo inválido.');

        const { data: currentDriver } = await ctx.supabaseAdmin.from('delivery_drivers').select('profile_id').eq('profile_id', driverId).maybeSingle();
        if (!currentDriver) throw new Error('Repartidor no encontrado.');

        const { error: authError } = await ctx.supabaseAdmin.auth.admin.updateUserById(driverId, { email, user_metadata: { full_name: fullName } });
        if (authError) throw authError;
        const { error: profileError } = await ctx.supabaseAdmin.from('profiles').update({ full_name: fullName }).eq('id', driverId);
        if (profileError) throw profileError;
        const { error: driverError } = await ctx.supabaseAdmin.from('delivery_drivers').update({ phone, vehicle_type: vehicleType }).eq('profile_id', driverId);
        if (driverError) throw driverError;

        const { data: currentRate } = await ctx.supabaseAdmin.from('delivery_driver_rates').select('commission_percent').eq('driver_id', driverId).is('valid_to', null).maybeSingle();
        if (Number(currentRate?.commission_percent ?? -1) !== commissionPercent) {
          const stamp = new Date().toISOString();
          const { error: closeError } = await ctx.supabaseAdmin.from('delivery_driver_rates').update({ valid_to: stamp }).eq('driver_id', driverId).is('valid_to', null);
          if (closeError) throw closeError;
          const { error: rateError } = await ctx.supabaseAdmin.from('delivery_driver_rates').insert({ driver_id: driverId, commission_percent: commissionPercent, valid_from: stamp, created_by: actorId });
          if (rateError) throw rateError;
        }
        return json({ ok: true, driverId });
      }

      if (action === 'toggle') {
        const driverId = requiredText(body.driverId, 'Repartidor');
        const active = Boolean(body.active);
        const { error: profileError } = await ctx.supabaseAdmin.from('profiles').update({ active }).eq('id', driverId);
        if (profileError) throw profileError;
        const { error: driverError } = await ctx.supabaseAdmin.from('delivery_drivers').update({ active }).eq('profile_id', driverId);
        if (driverError) throw driverError;
        return json({ ok: true, driverId, active });
      }

      if (action === 'resetPassword') {
        const driverId = requiredText(body.driverId, 'Repartidor');
        const password = requiredText(body.password, 'Contraseña', 8);
        const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(driverId, { password });
        if (error) throw error;
        return json({ ok: true, driverId });
      }

      return json({ error: 'Acción no soportada.' }, 400);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'No se pudo completar la operación.' }, 400);
    }
  }),
};
