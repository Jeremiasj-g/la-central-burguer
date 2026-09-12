export type DeliveryVehicleType = 'moto' | 'auto' | 'bici' | 'otro';
export type DeliveryAssignmentStatus = 'assigned' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
export type DeliverySettlementStatus = 'draft' | 'paid' | 'cancelled';

export interface DeliverySummary {
  unassignedOrders: number;
  activeAssignments: number;
  activeDrivers: number;
  pendingCommission: number;
  cashPending: number;
}

export interface DeliveryDriver {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  vehicleType: DeliveryVehicleType;
  active: boolean;
  commissionPercent: number | null;
  activeAssignments: number;
  deliveredCount: number;
  pendingCommission: number;
}

export interface DeliveryOrder {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  address: string | null;
  mapsUrl: string | null;
  distanceKm: number | null;
  deliveryCost: number;
  total: number;
  paymentMethod: 'efectivo' | 'transferencia';
  status: string;
  createdAt: string;
}

export interface DeliveryAssignment {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  address: string | null;
  mapsUrl: string | null;
  distanceKm: number | null;
  orderTotal: number;
  paymentMethod: 'efectivo' | 'transferencia';
  driverId: string;
  driverName: string;
  status: DeliveryAssignmentStatus;
  deliveryFee: number;
  commissionPercent: number;
  commissionAmount: number;
  cashToCollect: number;
  assignedAt: string;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
}

export interface DeliverySettlement {
  id: string;
  driverId: string;
  driverName: string;
  periodFrom: string;
  periodTo: string;
  status: DeliverySettlementStatus;
  notes: string | null;
  createdAt: string;
  paidAt: string | null;
  deliveries: number;
  commissionTotal: number;
  cashCollected: number;
  netBalance: number;
}

export interface DeliveryAdminDashboard {
  summary: DeliverySummary;
  drivers: DeliveryDriver[];
  unassignedOrders: DeliveryOrder[];
  assignments: DeliveryAssignment[];
  settlements: DeliverySettlement[];
}

export interface DeliveryDriverAssignment {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  address: string | null;
  mapsUrl: string | null;
  distanceKm: number | null;
  orderTotal: number;
  paymentMethod: 'efectivo' | 'transferencia';
  notes: string | null;
  status: DeliveryAssignmentStatus;
  deliveryFee: number;
  commissionPercent: number;
  commissionAmount: number;
  cashToCollect: number;
  assignedAt: string;
}

export interface DeliveryDriverDashboard {
  driver: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    vehicleType: DeliveryVehicleType;
    commissionPercent: number | null;
  };
  summary: {
    activeAssignments: number;
    todayCommission: number;
    monthCommission: number;
    pendingCommission: number;
    cashPending: number;
  };
  activeAssignments: DeliveryDriverAssignment[];
  recentDeliveries: Array<{
    id: string;
    orderCode: string;
    customerName: string;
    commissionAmount: number;
    cashToCollect: number;
    deliveredAt: string;
  }>;
  settlements: Omit<DeliverySettlement, 'driverId' | 'driverName' | 'notes'>[];
}

export interface DriverFormPayload {
  driverId?: string;
  fullName: string;
  email: string;
  password?: string;
  phone: string;
  vehicleType: DeliveryVehicleType;
  commissionPercent: number;
}
