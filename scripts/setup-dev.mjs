#!/usr/bin/env node
/**
 * Preparación segura de DEV: copia únicamente imágenes PÚBLICAS del catálogo
 * y, opcionalmente, crea un administrador de pruebas.
 *
 * No se conecta nunca con credenciales de escritura a producción.
 * Necesita la clave SECRET de Supabase DEV solo como variable local de entorno.
 *
 * DEV_SUPABASE_SECRET_KEY=... node scripts/setup-dev.mjs
 * DEV_SUPABASE_SECRET_KEY=... DEV_ADMIN_EMAIL=... DEV_ADMIN_PASSWORD=... node scripts/setup-dev.mjs --admin
 */

const DEV_REF = 'grtbdtavwllwarrbccht';
const PROD_REF = 'nryrcodrtmsrsqstozjj';
const DEV_URL = `https://${DEV_REF}.supabase.co`;
const DEV_KEY = process.env.DEV_SUPABASE_SECRET_KEY?.trim();
const BUCKETS = new Set(['product-images', 'business-assets', 'gallery-images']);

if (!DEV_KEY) {
  console.error('Falta DEV_SUPABASE_SECRET_KEY. Copiala desde Supabase DEV → Project Settings → API Keys.');
  process.exit(1);
}
if (DEV_KEY === process.env.PROD_SUPABASE_SECRET_KEY) {
  console.error('No utilices la misma clave que producción.');
  process.exit(1);
}
const authHeaders = { apikey: DEV_KEY, Authorization: `Bearer ${DEV_KEY}` };

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = (await response.text()).slice(0, 250);
    throw new Error(`HTTP ${response.status} en ${new URL(url).pathname}: ${body}`);
  }
  return response;
}

async function rows(table, select) {
  const url = new URL(`/rest/v1/${table}`, DEV_URL);
  url.searchParams.set('select', select);
  url.searchParams.set('limit', '1000');
  const response = await request(url, { headers: authHeaders });
  return response.json();
}

function sourceAsset(rawUrl) {
  if (!rawUrl) return null;
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== `${PROD_REF}.supabase.co`) return null;
  const prefix = '/storage/v1/object/public/';
  if (!url.pathname.startsWith(prefix)) return null;
  const [bucket, ...segments] = url.pathname.slice(prefix.length).split('/');
  if (!BUCKETS.has(bucket) || segments.length === 0) return null;
  return { bucket, path: segments.map(decodeURIComponent).join('/'), original: rawUrl };
}

async function importImage(asset) {
  const src = await request(asset.original);
  const contentType = src.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new Error(`Tipo de imagen inesperado: ${contentType}`);
  }
  const bytes = await src.arrayBuffer();
  if (bytes.byteLength > 4 * 1024 * 1024) throw new Error('Imagen supera 4 MB');
  const path = asset.path.split('/').map(encodeURIComponent).join('/');
  const target = `${DEV_URL}/storage/v1/object/${asset.bucket}/${path}`;
  await request(target, {
    method: 'POST',
    headers: { ...authHeaders, 'x-upsert': 'true', 'content-type': contentType },
    body: bytes,
  });
  return `${DEV_URL}/storage/v1/object/public/${asset.bucket}/${path}`;
}

async function rewriteUrl(table, column, previous, next) {
  const url = new URL(`/rest/v1/${table}`, DEV_URL);
  url.searchParams.set(column, `eq.${previous}`);
  await request(url, {
    method: 'PATCH',
    headers: { ...authHeaders, 'content-type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ [column]: next }),
  });
}

async function syncAssets() {
  const candidates = [];
  for (const [table, column] of [['products', 'image_url'], ['categories', 'image_url'], ['gallery_images', 'image_url'], ['business_config', 'logo_url']]) {
    for (const row of await rows(table, column)) {
      const item = sourceAsset(row[column]);
      if (item) candidates.push({ ...item, table, column });
    }
  }
  const distinct = new Map(candidates.map(item => [item.original, item]));
  let copied = 0;
  const mapped = new Map();
  for (const asset of distinct.values()) {
    const next = await importImage(asset);
    mapped.set(asset.original, next);
    copied++;
    console.log(`Imagen ${copied}/${distinct.size} copiada: ${asset.bucket}/${asset.path}`);
  }
  for (const item of candidates) {
    await rewriteUrl(item.table, item.column, item.original, mapped.get(item.original));
  }
  console.log(`Listo: ${copied} imágenes propias en Storage DEV, ${candidates.length} referencias actualizadas.`);
}

async function createDevAdmin() {
  const email = process.env.DEV_ADMIN_EMAIL?.trim();
  const password = process.env.DEV_ADMIN_PASSWORD;
  if (!email || !password || password.length < 14) {
    throw new Error('Para --admin, definí DEV_ADMIN_EMAIL y DEV_ADMIN_PASSWORD (mínimo 14 caracteres).');
  }
  const response = await request(`${DEV_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      email, password, email_confirm: true,
      user_metadata: { full_name: 'Administrador de pruebas' },
    }),
  });
  const created = await response.json();
  const id = created.id ?? created.user?.id;
  if (!id) throw new Error('No se obtuvo el ID del usuario DEV.');
  const profileUrl = new URL('/rest/v1/profiles', DEV_URL);
  profileUrl.searchParams.set('id', `eq.${id}`);
  await request(profileUrl, {
    method: 'PATCH', headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ active: true, full_name: 'Administrador DEV' }),
  });

  const roleUrl = new URL('/rest/v1/roles', DEV_URL);
  roleUrl.searchParams.set('select', 'id');
  roleUrl.searchParams.set('code', 'eq.admin');
  const roleRows = await (await request(roleUrl, { headers: authHeaders })).json();
  const roleId = roleRows[0]?.id;
  if (!roleId) throw new Error('No existe el rol admin en la base DEV.');

  await request(`${DEV_URL}/rest/v1/user_roles`, {
    method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ user_id: id, role_id: roleId }),
  });
  console.log(`Usuario administrador DEV creado y habilitado: ${email}`);
  console.log('No se muestra ni almacena la contraseña.');
}

try {
  if (process.argv.includes('--admin')) await createDevAdmin();
  else await syncAssets();
} catch (error) {
  console.error('Error de preparación DEV:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
