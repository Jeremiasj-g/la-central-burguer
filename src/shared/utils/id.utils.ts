export function createId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createOrderCode() {
  const today = new Date();
  const datePart = today.toISOString().slice(2, 10).replaceAll('-', '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `LCB-${datePart}-${random}`;
}
