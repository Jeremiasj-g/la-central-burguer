import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  AccessManagementDashboard,
  AccessRoleFormPayload,
  AccessUser,
  AccessUserFormPayload,
} from '../types/access.types';

type RpcError = { message: string } | null;
type RpcInvoker = <T>(name: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError }>;
type InvitationState = {
  userId: string;
  invitedAt: string | null;
  confirmationSentAt: string | null;
  emailConfirmedAt: string | null;
};

type InvitationStatusResponse = { users?: InvitationState[]; error?: string };
type InviteResponse = { ok?: boolean; userId?: string; error?: string };

function client() {
  requireSupabaseConfigured('gestionar usuarios y roles');
  return getSupabaseBrowserClient();
}

async function accessRpc<T>(name: string, args?: Record<string, unknown>) {
  const supabase = client();
  const invoke = supabase.rpc.bind(supabase) as unknown as RpcInvoker;
  const { data, error } = await invoke<T>(name, args);
  if (error) throw new Error(error.message);
  return data;
}

function edgeError(data: unknown) {
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error;
  return null;
}

async function edgeFunctionErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as unknown;
        const message = edgeError(payload);
        if (message) return message;
      } catch {
        try {
          const text = await context.clone().text();
          if (text.trim()) return text.trim();
        } catch {
          // Usa el mensaje del SDK si no se puede leer la respuesta.
        }
      }
    }
  }

  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

async function invokeEdge<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().functions.invoke(functionName, { body });
  if (error) throw new Error(await edgeFunctionErrorMessage(error));
  const message = edgeError(data);
  if (message) throw new Error(message);
  return data as T;
}

async function invokeUserAction(body: Record<string, unknown>) {
  return invokeEdge<Record<string, unknown>>('manage-access-user', body);
}

function activationUrl() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/activar-cuenta`;
}

function mergeInvitationState(user: Omit<AccessUser, 'invitedAt' | 'confirmationSentAt' | 'emailConfirmedAt' | 'accessStatus'>, state?: InvitationState): AccessUser {
  const invitedAt = state?.invitedAt ?? null;
  const confirmationSentAt = state?.confirmationSentAt ?? null;
  const emailConfirmedAt = state?.emailConfirmedAt ?? null;
  const accessStatus = user.archivedAt
    ? 'archived' as const
    : invitedAt && !emailConfirmedAt
      ? 'pending_activation' as const
      : !user.active
        ? 'inactive' as const
        : 'active' as const;

  return {
    ...user,
    active: accessStatus === 'active',
    invitedAt,
    confirmationSentAt,
    emailConfirmedAt,
    accessStatus,
    delivery: user.delivery ? { ...user.delivery, active: user.delivery.active && accessStatus === 'active' } : null,
  };
}

export async function getAccessManagementDashboard(): Promise<AccessManagementDashboard> {
  const data = await accessRpc<Omit<AccessManagementDashboard, 'users'> & { users: Array<Omit<AccessUser, 'invitedAt' | 'confirmationSentAt' | 'emailConfirmedAt' | 'accessStatus'>> }>('get_access_management_dashboard');
  if (!data) throw new Error('No se pudo obtener la administración de accesos.');

  let states = new Map<string, InvitationState>();
  if (data.users.length > 0) {
    try {
      const status = await invokeEdge<InvitationStatusResponse>('access-invitation-status', {
        userIds: data.users.map((user) => user.id),
      });
      states = new Map((status.users ?? []).map((item) => [item.userId, item]));
    } catch {
      // El CRUD sigue disponible aunque temporalmente no se pueda consultar Auth.
    }
  }

  return {
    ...data,
    users: data.users.map((user) => mergeInvitationState(user, states.get(user.id))),
  };
}

export async function saveAccessUser(payload: AccessUserFormPayload) {
  if (payload.userId) {
    return invokeUserAction({ action: 'update', ...payload });
  }

  if (payload.sendInvitation === false) {
    if (!payload.password || payload.password.length < 8) {
      throw new Error('La contraseña inicial debe tener al menos 8 caracteres.');
    }
    return invokeUserAction({ action: 'create', ...payload });
  }

  const dashboard = await accessRpc<Pick<AccessManagementDashboard, 'roles'>>('get_access_management_dashboard');
  if (!dashboard) throw new Error('No se pudieron validar los roles seleccionados.');
  const roleCodes = dashboard.roles
    .filter((role) => payload.roleIds.includes(role.id))
    .map((role) => role.code);
  if (roleCodes.length !== payload.roleIds.length) throw new Error('Uno o más roles seleccionados ya no están disponibles.');

  const invite = await invokeEdge<InviteResponse>('invite-access-user', {
    fullName: payload.fullName,
    email: payload.email,
    roleCodes,
    redirectTo: activationUrl(),
  });
  if (!invite.userId) throw new Error('Supabase no devolvió el identificador del usuario invitado.');

  try {
    await invokeUserAction({
      action: 'update',
      ...payload,
      userId: invite.userId,
    });
    await invokeUserAction({ action: 'setActive', userId: invite.userId, active: false });
    return { ...invite, invited: true };
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : 'No se pudo configurar el usuario.'} La invitación fue creada; podés completar la configuración editando el usuario pendiente.`);
  }
}

export async function setAccessUserActive(userId: string, active: boolean) {
  return invokeUserAction({ action: 'setActive', userId, active });
}

export async function archiveAccessUser(userId: string) {
  return invokeUserAction({ action: 'archive', userId });
}

export async function restoreAccessUser(userId: string) {
  return invokeUserAction({ action: 'restore', userId });
}

export async function resetAccessUserPassword(userId: string, password: string) {
  return invokeUserAction({ action: 'resetPassword', userId, password });
}

export async function saveAccessRole(payload: AccessRoleFormPayload) {
  if (payload.roleId) {
    await accessRpc<null>('admin_update_role', {
      role_uuid: payload.roleId,
      role_code: payload.code,
      role_name: payload.name,
      role_description: payload.description.trim() || null,
      role_active: payload.active,
      permission_codes: payload.permissionCodes,
    });
    return;
  }

  await accessRpc<string>('admin_create_role', {
    role_code: payload.code,
    role_name: payload.name,
    role_description: payload.description.trim() || null,
    permission_codes: payload.permissionCodes,
  });
}

export async function deleteAccessRole(roleId: string) {
  await accessRpc<null>('admin_delete_role', { role_uuid: roleId });
}
