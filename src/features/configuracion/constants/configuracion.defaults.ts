import type { BusinessConfig } from '../types/configuracion.types';

export const BUSINESS_CONFIG_DEFAULTS: BusinessConfig = {
  businessName: 'La Central Burger',
  logoUrl: '',
  logoPath: null,
  heroDescription: 'Hamburguesas, lomitos, sándwichs de milanesa, figazzas, pizzas y milanesas XXL. Sabor bien cargado, papas fritas y pedidos rápidos por WhatsApp.',
  whatsappNumber: '543794752707',
  transferAlias: 'jeremiasjg.mp',
  transferCvu: '0000003100068262525673',
  address: 'Madariaga 246',
  specialty: 'Papas incluidas',
  isOpen: true,
  autoScheduleEnabled: true,
  autoOpenTime: '20:00',
  autoCloseTime: '00:00',
  storeLatitude: -27.4692,
  storeLongitude: -58.8306,
  deliveryBaseFee: 800,
  deliveryPricePerKm: 400,
  deliveryMaxDistanceKm: 8,
  deliveryRoundingValue: 100,
  paymentMethods: [
    { id: 'pay-efectivo', name: 'Efectivo', type: 'efectivo', active: true },
    { id: 'pay-transferencia', name: 'Transferencia', type: 'transferencia', active: true },
  ],
};
