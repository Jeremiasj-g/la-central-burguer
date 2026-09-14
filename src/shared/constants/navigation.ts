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
  { label: 'Dashboard', href: ROUTES.adminDashboard, icon: LayoutDashboard, development: false },
  { label: 'Productos', href: ROUTES.adminProductos, icon: Beef, development: false },
  { label: 'Categorías', href: ROUTES.adminCategorias, icon: Tags, development: false },
  { label: 'Ingredientes', href: ROUTES.adminIngredientes, icon: Boxes, development: false },
  { label: 'Recetas', href: ROUTES.adminRecetas, icon: BookOpenCheck, development: false },
  { label: 'Pedidos', href: ROUTES.adminPedidos, icon: ClipboardList, development: false },
  { label: 'Venta mostrador', href: ROUTES.adminVentaMostrador, icon: Store, development: false },
  { label: 'Delivery', href: ROUTES.adminDelivery, icon: Truck, development: true },
  { label: 'Usuarios y roles', href: ROUTES.adminUsuarios, icon: Users, development: false },
  { label: 'Reportes', href: ROUTES.adminReportes, icon: FileSpreadsheet, development: false },
  { label: 'Configuración', href: ROUTES.adminConfiguracion, icon: Settings, development: false },
] as const;

export const CATEGORY_ICON_HINTS = {
  promos: BadgePercent,
  hamburguesas: Beef,
  pizzas: Pizza,
  lomitos: Utensils,
  sandwiches: ShoppingBag,
  default: Utensils,
};
