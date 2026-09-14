const getUser = vi.fn();
const signOut = vi.fn();
const rpc = vi.fn();

const supabaseMock = {
  auth: {
    getUser,
    signOut,
  },
  rpc,
};

vi.mock('@/lib/config/env', () => ({
  requireSupabaseConfigured: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: () => supabaseMock,
}));

const { getAdminSession, isAdminLoggedIn } = await import('../../src/features/auth/services/auth.service.ts');

const adminUser = {
  id: 'admin-test-id',
  email: 'admin@example.com',
  created_at: '2026-09-14T00:00:00.000Z',
};

function mockAuthenticatedUser() {
  getUser.mockResolvedValue({ data: { user: adminUser }, error: null });
}

function mockAccessContext(overrides = {}) {
  rpc.mockResolvedValue({
    data: {
      userId: adminUser.id,
      fullName: 'Administrador Test',
      phone: null,
      active: true,
      email: adminUser.email,
      roles: ['admin'],
      permissions: [],
      ...overrides,
    },
    error: null,
  });
}

describe('Seguridad de acceso al panel administrativo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza a un visitante sin sesión', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getAdminSession()).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('isAdminLoggedIn devuelve false para un visitante anónimo', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(isAdminLoggedIn()).resolves.toBe(false);
  });

  it('rechaza a un usuario autenticado que no tenga rol admin', async () => {
    mockAuthenticatedUser();
    mockAccessContext({ roles: ['delivery'] });

    await expect(getAdminSession()).resolves.toBeNull();
  });

  it('rechaza a un administrador inactivo', async () => {
    mockAuthenticatedUser();
    mockAccessContext({ active: false, roles: ['admin'] });

    await expect(getAdminSession()).resolves.toBeNull();
  });

  it('rechaza el acceso si falla la consulta de permisos', async () => {
    mockAuthenticatedUser();
    rpc.mockResolvedValue({ data: null, error: { message: 'RPC unavailable' } });

    await expect(getAdminSession()).resolves.toBeNull();
  });

  it('acepta a un usuario activo con rol admin', async () => {
    mockAuthenticatedUser();
    mockAccessContext();

    await expect(getAdminSession()).resolves.toEqual({
      id: adminUser.id,
      email: adminUser.email,
      name: 'Administrador Test',
      role: 'admin',
      createdAt: adminUser.created_at,
    });
  });
});
