import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  AccessManagementDashboard,
  AccessRoleFormPayload,
  AccessUserFormPayload,
} from '../types/access.types';

type RpcError = { message: string } | null;
type RpcInvoker = <T>(name: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError }>;

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

async function invokeUserAction(body: Record<string, unknown>) {
  const { data, error } = await client().functions.invoke('manage-access-user', { body });
  if (error) throw new Error(error.message);
  const message = edgeError(data);
  if (message) throw new Error(message);
  return data;
}

export async function getAccessManagementDashboard(): Promise<AccessManagementDashboard> {
  const data = await accessRpc<AccessManagementDashboard>('get_access_management_dashboard');
  if (!data) throw new Error('No se pudo obtener la administración de accesos.');
  return data;
}

export async function saveAccessUser(payload: AccessUserFormPayload) {
  return invokeUserAction({
    action: payload.userId ? 'update' : 'create',
    ...payload,
  });
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
