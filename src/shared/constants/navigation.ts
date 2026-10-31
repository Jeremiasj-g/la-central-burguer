import {
  BadgePercent,
  Beef,
  BookOpenCheck,
  Boxes,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  Pizza,
  Settings,
  ShoppingBag,
  Store,
  Tags,
  Truck,
  Users,
  Utensils,
} from 'lucide-react';
import { ROUTES } from './routes';

export const PUBLIC_NAVIGATION = [
  { label: 'Inicio', href: ROUTES.home },
  { label: 'Menú', href: ROUTES.menu },
] as const;

export const ADMIN_NAVIGATION = [
  { label: 'Dashboard', group: 'Resumen', href: ROUTES.adminDashboard, icon: LayoutDashboard, development: false },
  { label: 'Productos', group: 'Catálogo', href: ROUTES.adminProductos, icon: Beef, development: false },
  { label: 'Categorías', group: 'Catálogo', href: ROUTES.adminCategorias, icon: Tags, development: false },
  { label: 'Ingredientes', group: 'Catálogo', href: ROUTES.adminIngredientes, icon: Boxes, development: false },
  { label: 'Recetas', group: 'Catálogo', href: ROUTES.adminRecetas, icon: BookOpenCheck, development: false },
  { label: 'Descuentos', group: 'Catálogo', href: ROUTES.adminDescuentos, icon: BadgePercent, development: false },
  { label: 'Pedidos', group: 'Operación', href: ROUTES.adminPedidos, icon: ClipboardList, development: false },
  { label: 'Venta mostrador', group: 'Operación', href: ROUTES.adminVentaMostrador, icon: Store, development: false },
  { label: 'Delivery', group: 'Operación', href: ROUTES.adminDelivery, icon: Truck, development: true },
  { label: 'Usuarios y roles', group: 'Administración', href: ROUTES.adminUsuarios, icon: Users, development: false },
  { label: 'Reportes', group: 'Administración', href: ROUTES.adminReportes, icon: FileSpreadsheet, development: false },
  { label: 'Configuración', group: 'Administración', href: ROUTES.adminConfiguracion, icon: Settings, development: false },
] as const;

export const CATEGORY_ICON_HINTS = {
  promos: BadgePercent,
  hamburguesas: Beef,
  pizzas: Pizza,
  lomitos: Utensils,
  sandwiches: ShoppingBag,
  default: Utensils,
};
