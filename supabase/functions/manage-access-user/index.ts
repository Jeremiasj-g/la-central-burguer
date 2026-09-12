import { withSupabase } from 'npm:@supabase/server';

const json = (body: unknown, status = 200) => Response.json(body, { status });
const vehicleTypes = new Set(['moto', 'auto', 'bici', 'otro']);

function text(value: unknown) {
  return String(value ?? '').trim();
}

function required(value: unknown, label: string, min = 1) {
  const result = text(value);
  if (result.length < min) throw new Error(`${label} es obligatorio.`);
  return result;
}

function optional(value: unknown) {
  const result = text(value);
  return result || null;
}

function uniqueIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item)).filter(Boolean))];
}

function commission(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error('La comisión debe estar entre 0 y 100.');
  }
  return Math.round(parsed * 100) / 100;
}

async function getRoleRows(admin: any, roleIds: string[]) {
  if (roleIds.length === 0) throw new Error('Seleccioná al menos un rol.');
  const { data, error } = await admin.from('roles').select('id,code,name,active').in('id', roleIds);
  if (error) throw error;
  if (!data || data.length !== roleIds.length || data.some((role: any) => !role.active)) {
    throw new Error('Uno o más roles no existen o están inactivos.');
  }
  return data as Array<{ id: string; code: string; name: string; active: boolean }>;
}

async function assertAdmin(admin: any, actorId: string) {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,active,archived_at')
    .eq('id', actorId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !profile.active || profile.archived_at) throw new Error('No autorizado.');

  const { data: adminRole, error: roleError } = await admin
    .from('roles')
    .select('id')
    .eq('code', 'admin')
    .eq('active', true)
    .maybeSingle();
  if (roleError) throw roleError;
  if (!adminRole) throw new Error('El rol administrador no está configurado.');

  const { data: assignment, error: assignmentError } = await admin
    .from('user_roles')
    .select('user_id')
    .eq('user_id', actorId)
    .eq('role_id', adminRole.id)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error('No autorizado.');
  return adminRole.id as string;
}

async function ensureNotLastAdmin(admin: any, targetId: string, adminRoleId: string) {
  const { data: targetAdmin } = await admin
    .from('user_roles')
    .select('user_id')
    .eq('user_id', targetId)
    .eq('role_id', adminRoleId)
    .maybeSingle();
  if (!targetAdmin) return;

  const { data: otherAssignments, error } = await admin
    .from('user_roles')
    .select('user_id')
    .eq('role_id', adminRoleId)
    .neq('user_id', targetId);
  if (error) throw error;
  const ids = [...new Set((otherAssignments ?? []).map((row: any) => row.user_id))];
  if (ids.length === 0) throw new Error('No podés quitar o desactivar al último administrador activo.');

  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .in('id', ids)
    .eq('active', true)
    .is('archived_at', null);
  if (profileError) throw profileError;
  if (!profiles || profiles.length === 0) throw new Error('No podés quitar o desactivar al último administrador activo.');
}

async function syncRoles(admin: any, userId: string, actorId: string, roles: Array<{ id: string; code: string }>) {
  const { error: deleteError } = await admin.from('user_roles').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;
  const { error: insertError } = await admin.from('user_roles').insert(
    roles.map((role) => ({ user_id: userId, role_id: role.id, assigned_by: actorId })),
  );
  if (insertError) throw insertError;
}

async function syncDelivery(admin: any, userId: string, actorId: string, roleCodes: string[], body: any, accountActive: boolean) {
  const isDelivery = roleCodes.includes('delivery');
  const { data: currentDriver } = await admin
    .from('delivery_drivers')
    .select('profile_id,vehicle_type,active')
    .eq('profile_id', userId)
    .maybeSingle();

  if (!isDelivery) {
    if (currentDriver) {
      const { error } = await admin.from('delivery_drivers').update({ active: false }).eq('profile_id', userId);
      if (error) throw error;
    }
    return;
  }

  const vehicleType = text(body.vehicleType || currentDriver?.vehicle_type || 'moto');
  if (!vehicleTypes.has(vehicleType)) throw new Error('Tipo de vehículo inválido.');
  const newCommission = commission(body.commissionPercent);

  const { error: driverError } = await admin.from('delivery_drivers').upsert({
    profile_id: userId,
    vehicle_type: vehicleType,
    active: accountActive,
  }, { onConflict: 'profile_id' });
  if (driverError) throw driverError;

  const { data: currentRate, error: currentRateError } = await admin
    .from('delivery_driver_rates')
    .select('id,commission_percent')
    .eq('driver_id', userId)
    .is('valid_to', null)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentRateError) throw currentRateError;

  if (!currentRate || Number(currentRate.commission_percent) !== newCommission) {
    const stamp = new Date().toISOString();
    if (currentRate) {
      const { error: closeError } = await admin
        .from('delivery_driver_rates')
        .update({ valid_to: stamp })
        .eq('id', currentRate.id);
      if (closeError) throw closeError;
    }
    const { error: rateError } = await admin.from('delivery_driver_rates').insert({
      driver_id: userId,
      commission_percent: newCommission,
      valid_from: stamp,
      created_by: actorId,
    });
    if (rateError) throw rateError;
  }
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method === 'OPTIONS') return new Response('ok');
    if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

    const actorId = ctx.userClaims?.sub;
    if (!actorId) return json({ error: 'Sesión inválida.' }, 401);

    try {
      const admin = ctx.supabaseAdmin;
      const adminRoleId = await assertAdmin(admin, actorId);
      const body = await req.json();
      const action = text(body?.action);

      if (action === 'create') {
        const fullName = required(body.fullName, 'Nombre', 2);
        const email = required(body.email, 'Email', 5).toLowerCase();
        const password = required(body.password, 'Contraseña', 8);
        const phone = optional(body.phone);
        const notes = optional(body.notes);
        const roleIds = uniqueIds(body.roleIds);
        const roleRows = await getRoleRows(admin, roleIds);
        const roleCodes = roleRows.map((role) => role.code);
        if (roleCodes.includes('delivery')) commission(body.commissionPercent);

        let createdUserId: string | null = null;
        try {
          const { data: created, error: createError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
            app_metadata: { app_roles: roleCodes },
          });
          if (createError || !created.user) throw new Error(createError?.message ?? 'No se pudo crear el usuario.');
          createdUserId = created.user.id;

          const { error: profileError } = await admin.from('profiles').update({
            full_name: fullName,
            phone,
            notes,
            active: true,
            archived_at: null,
          }).eq('id', createdUserId);
          if (profileError) throw profileError;

          await syncRoles(admin, createdUserId, actorId, roleRows);
          await syncDelivery(admin, createdUserId, actorId, roleCodes, body, true);
          return json({ ok: true, userId: createdUserId });
        } catch (error) {
          if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
          throw error;
        }
      }

      if (action === 'update') {
        const userId = required(body.userId, 'Usuario');
        const fullName = required(body.fullName, 'Nombre', 2);
        const email = required(body.email, 'Email', 5).toLowerCase();
        const phone = optional(body.phone);
        const notes = optional(body.notes);
        const roleIds = uniqueIds(body.roleIds);
        const roleRows = await getRoleRows(admin, roleIds);
        const roleCodes = roleRows.map((role) => role.code);
        const keepsAdmin = roleRows.some((role) => role.id === adminRoleId);
        if (!keepsAdmin) await ensureNotLastAdmin(admin, userId, adminRoleId);
        if (roleCodes.includes('delivery')) commission(body.commissionPercent);

        const { data: profile, error: profileReadError } = await admin
          .from('profiles')
          .select('active,archived_at')
          .eq('id', userId)
          .maybeSingle();
        if (profileReadError) throw profileReadError;
        if (!profile) throw new Error('Usuario no encontrado.');

        const { error: authError } = await admin.auth.admin.updateUserById(userId, {
          email,
          user_metadata: { full_name: fullName },
          app_metadata: { app_roles: roleCodes },
        });
        if (authError) throw authError;

        const { error: profileError } = await admin.from('profiles').update({ full_name: fullName, phone, notes }).eq('id', userId);
        if (profileError) throw profileError;
        await syncRoles(admin, userId, actorId, roleRows);
        await syncDelivery(admin, userId, actorId, roleCodes, body, Boolean(profile.active && !profile.archived_at));
        return json({ ok: true, userId });
      }

      if (action === 'setActive') {
        const userId = required(body.userId, 'Usuario');
        const active = Boolean(body.active);
        if (!active) await ensureNotLastAdmin(admin, userId, adminRoleId);
        const { error: profileError } = await admin.from('profiles').update({ active }).eq('id', userId).is('archived_at', null);
        if (profileError) throw profileError;
        const { error: driverError } = await admin.from('delivery_drivers').update({ active }).eq('profile_id', userId);
        if (driverError) throw driverError;
        return json({ ok: true, userId, active });
      }

      if (action === 'archive') {
        const userId = required(body.userId, 'Usuario');
        if (userId === actorId) throw new Error('No podés archivar tu propia cuenta.');
        await ensureNotLastAdmin(admin, userId, adminRoleId);
        const stamp = new Date().toISOString();
        const { error: profileError } = await admin.from('profiles').update({ active: false, archived_at: stamp }).eq('id', userId);
        if (profileError) throw profileError;
        const { error: driverError } = await admin.from('delivery_drivers').update({ active: false }).eq('profile_id', userId);
        if (driverError) throw driverError;
        return json({ ok: true, userId, archivedAt: stamp });
      }

      if (action === 'restore') {
        const userId = required(body.userId, 'Usuario');
        const { error: profileError } = await admin.from('profiles').update({ active: true, archived_at: null }).eq('id', userId);
        if (profileError) throw profileError;
        const { data: deliveryRole } = await admin.from('roles').select('id').eq('code', 'delivery').maybeSingle();
        if (deliveryRole) {
          const { data: hasDelivery } = await admin.from('user_roles').select('user_id').eq('user_id', userId).eq('role_id', deliveryRole.id).maybeSingle();
          if (hasDelivery) await admin.from('delivery_drivers').update({ active: true }).eq('profile_id', userId);
        }
        return json({ ok: true, userId });
      }

      if (action === 'resetPassword') {
        const userId = required(body.userId, 'Usuario');
        const password = required(body.password, 'Contraseña', 8);
        const { error } = await admin.auth.admin.updateUserById(userId, { password });
        if (error) throw error;
        return json({ ok: true, userId });
      }

      return json({ error: 'Acción no soportada.' }, 400);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'No se pudo completar la operación.' }, 400);
    }
  }),
};
