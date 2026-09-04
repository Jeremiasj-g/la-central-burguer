import {
  BadgePercent,
  BarChart3,
  Beef,
  BookOpenCheck,
  Boxes,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  Pizza,
  Settings,
  ShoppingBag,
  Tags,
  Utensils,
} from 'lucide-react';
import { ROUTES } from './routes';

export const PUBLIC_NAVIGATION = [
  { label: 'Inicio', href: ROUTES.home },
  { label: 'Menú', href: ROUTES.menu },
] as const;

export const ADMIN_NAVIGATION = [
  { label: 'Dashboard', href: ROUTES.adminDashboard, icon: LayoutDashboard },
  { label: 'Productos', href: ROUTES.adminProductos, icon: Beef },
  { label: 'Categorías', href: ROUTES.adminCategorias, icon: Tags },
  { label: 'Ingredientes', href: ROUTES.adminIngredientes, icon: Boxes },
  { label: 'Recetas', href: ROUTES.adminRecetas, icon: BookOpenCheck },
  { label: 'Pedidos', href: ROUTES.adminPedidos, icon: ClipboardList },
  { label: 'Ventas', href: ROUTES.adminVentas, icon: BarChart3 },
  { label: 'Reportes', href: ROUTES.adminReportes, icon: FileSpreadsheet },
  { label: 'Configuración', href: ROUTES.adminConfiguracion, icon: Settings },
] as const;

export const CATEGORY_ICON_HINTS = {
  promos: BadgePercent,
  hamburguesas: Beef,
  pizzas: Pizza,
  lomitos: Utensils,
  sandwiches: ShoppingBag,
  default: Utensils,
};
