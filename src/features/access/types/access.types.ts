export type AccessVehicleType = 'moto' | 'auto' | 'bici' | 'otro';

export interface AccessPermission {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
  active: boolean;
}

export interface AccessRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  active: boolean;
  usersCount: number;
  permissionCodes: string[];
}

export interface AccessUserRole {
  id: string;
  code: string;
  name: string;
}

export interface AccessUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  archivedAt: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  roles: AccessUserRole[];
  delivery: {
    vehicleType: AccessVehicleType;
    active: boolean;
    commissionPercent: number | null;
  } | null;
}

export interface AccessManagementDashboard {
  users: AccessUser[];
  roles: AccessRole[];
  permissions: AccessPermission[];
}

export interface AccessUserFormPayload {
  userId?: string;
  fullName: string;
  email: string;
  password?: string;
  phone: string;
  notes: string;
  roleIds: string[];
  vehicleType?: AccessVehicleType;
  commissionPercent?: number;
}

export interface AccessRoleFormPayload {
  roleId?: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
  permissionCodes: string[];
}
