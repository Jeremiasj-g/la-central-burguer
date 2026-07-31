export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = 'admin' | 'staff';
export type IngredientType = 'proteina' | 'panificados' | 'lacteos' | 'verduras' | 'insumos' | 'bebidas' | 'otros';
export type IngredientUnit = 'kg' | 'gr' | 'unidad' | 'litro' | 'ml' | 'paquete';
export type OrderStatus = 'pendiente' | 'aceptado' | 'en_preparacion' | 'listo' | 'en_camino' | 'entregado' | 'cancelado';
export type DeliveryMethod = 'retiro_local' | 'delivery';
export type PaymentMethodCode = 'efectivo' | 'transferencia';

export interface DeliveryQuoteRow {
  distance_km: number;
  delivery_cost: number;
  is_within_range: boolean;
  maps_url: string;
}

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDefinition<
        { id: string; full_name: string; role: AppRole; active: boolean; created_at: string; updated_at: string },
        { id: string; full_name?: string; role?: AppRole; active?: boolean; created_at?: string; updated_at?: string },
        { full_name?: string; role?: AppRole; active?: boolean; updated_at?: string }
      >;
      business_config: TableDefinition<
        {
          id: number; business_name: string; logo_url: string; logo_path: string | null; hero_description: string; whatsapp_number: string; transfer_alias: string;
          transfer_cvu: string; address: string; specialty: string; timezone: string; is_open: boolean;
          auto_schedule_enabled: boolean; auto_open_time: string; auto_close_time: string;
          store_latitude: number | null; store_longitude: number | null; delivery_base_fee: number;
          delivery_price_per_km: number; delivery_max_distance_km: number; delivery_rounding_value: number;
          created_at: string; updated_at: string;
        },
        {
          id?: number; business_name: string; logo_url?: string; logo_path?: string | null; hero_description?: string; whatsapp_number: string; transfer_alias?: string;
          transfer_cvu?: string; address?: string; specialty?: string; timezone?: string; is_open?: boolean;
          auto_schedule_enabled?: boolean; auto_open_time?: string; auto_close_time?: string;
          store_latitude?: number | null; store_longitude?: number | null; delivery_base_fee?: number;
          delivery_price_per_km?: number; delivery_max_distance_km?: number; delivery_rounding_value?: number;
          created_at?: string; updated_at?: string;
        },
        {
          business_name?: string; logo_url?: string; logo_path?: string | null; hero_description?: string; whatsapp_number?: string; transfer_alias?: string;
          transfer_cvu?: string; address?: string; specialty?: string; timezone?: string; is_open?: boolean;
          auto_schedule_enabled?: boolean; auto_open_time?: string; auto_close_time?: string;
          store_latitude?: number | null; store_longitude?: number | null; delivery_base_fee?: number;
          delivery_price_per_km?: number; delivery_max_distance_km?: number; delivery_rounding_value?: number;
          updated_at?: string;
        }
      >;
      payment_methods: TableDefinition<
        { id: string; name: string; code: PaymentMethodCode; active: boolean; display_order: number; created_at: string; updated_at: string },
        { id?: string; name: string; code: PaymentMethodCode; active?: boolean; display_order?: number; created_at?: string; updated_at?: string },
        { name?: string; code?: PaymentMethodCode; active?: boolean; display_order?: number; updated_at?: string }
      >;
      categories: TableDefinition<
        { id: string; name: string; slug: string; description: string | null; icon_name: string | null; image_url: string | null; display_order: number; active: boolean; deleted_at: string | null; created_at: string; updated_at: string },
        { id?: string; name: string; slug?: string; description?: string | null; icon_name?: string | null; image_url?: string | null; display_order?: number; active?: boolean; deleted_at?: string | null; created_at?: string; updated_at?: string },
        { name?: string; slug?: string; description?: string | null; icon_name?: string | null; image_url?: string | null; display_order?: number; active?: boolean; deleted_at?: string | null; updated_at?: string }
      >;
      ingredients: TableDefinition<
        { id: string; name: string; type: IngredientType; unit: IngredientUnit; supplier: string | null; active: boolean; last_updated_at: string; deleted_at: string | null; created_at: string; updated_at: string },
        { id?: string; name: string; type?: IngredientType; unit?: IngredientUnit; supplier?: string | null; active?: boolean; last_updated_at?: string; deleted_at?: string | null; created_at?: string; updated_at?: string },
        { name?: string; type?: IngredientType; unit?: IngredientUnit; supplier?: string | null; active?: boolean; last_updated_at?: string; deleted_at?: string | null; updated_at?: string }
      >;
      products: TableDefinition<
        { id: string; category_id: string; name: string; slug: string; description: string; image_url: string; image_path: string | null; current_price: number; active: boolean; available: boolean; featured: boolean; is_promotion: boolean; display_order: number; deleted_at: string | null; created_at: string; updated_at: string },
        { id?: string; category_id: string; name: string; slug?: string; description?: string; image_url?: string; image_path?: string | null; current_price: number; active?: boolean; available?: boolean; featured?: boolean; is_promotion?: boolean; display_order?: number; deleted_at?: string | null; created_at?: string; updated_at?: string },
        { category_id?: string; name?: string; slug?: string; description?: string; image_url?: string; image_path?: string | null; current_price?: number; active?: boolean; available?: boolean; featured?: boolean; is_promotion?: boolean; display_order?: number; deleted_at?: string | null; updated_at?: string }
      >;
      product_ingredients: TableDefinition<
        { id: string; product_id: string; ingredient_id: string; quantity: number | null; unit: IngredientUnit | null; display_order: number; created_at: string; updated_at: string },
        { id?: string; product_id: string; ingredient_id: string; quantity?: number | null; unit?: IngredientUnit | null; display_order?: number; created_at?: string; updated_at?: string },
        { quantity?: number | null; unit?: IngredientUnit | null; display_order?: number; updated_at?: string }
      >;
      customers: TableDefinition<
        { id: string; full_name: string; phone: string; normalized_phone: string; email: string | null; default_address: string | null; default_latitude: number | null; default_longitude: number | null; order_count: number; last_order_at: string | null; created_at: string; updated_at: string },
        { id?: string; full_name: string; phone: string; normalized_phone: string; email?: string | null; default_address?: string | null; default_latitude?: number | null; default_longitude?: number | null; order_count?: number; last_order_at?: string | null; created_at?: string; updated_at?: string },
        { full_name?: string; phone?: string; normalized_phone?: string; email?: string | null; default_address?: string | null; default_latitude?: number | null; default_longitude?: number | null; order_count?: number; last_order_at?: string | null; updated_at?: string }
      >;
      orders: TableDefinition<
        { id: string; order_code: string; customer_id: string | null; customer_name: string; customer_phone: string; customer_email: string | null; delivery_method: DeliveryMethod; address: string | null; customer_latitude: number | null; customer_longitude: number | null; delivery_distance_km: number | null; delivery_maps_url: string | null; payment_method: PaymentMethodCode; subtotal: number; delivery_cost: number; total: number; status: OrderStatus; notes: string | null; source: string; accepted_at: string | null; cancelled_at: string | null; created_at: string; updated_at: string },
        { id?: string; order_code?: string; customer_id?: string | null; customer_name: string; customer_phone: string; customer_email?: string | null; delivery_method: DeliveryMethod; address?: string | null; customer_latitude?: number | null; customer_longitude?: number | null; delivery_distance_km?: number | null; delivery_maps_url?: string | null; payment_method: PaymentMethodCode; subtotal: number; delivery_cost?: number; status?: OrderStatus; notes?: string | null; source?: string; accepted_at?: string | null; cancelled_at?: string | null; created_at?: string; updated_at?: string },
        { customer_id?: string | null; customer_name?: string; customer_phone?: string; customer_email?: string | null; delivery_method?: DeliveryMethod; address?: string | null; customer_latitude?: number | null; customer_longitude?: number | null; delivery_distance_km?: number | null; delivery_maps_url?: string | null; payment_method?: PaymentMethodCode; subtotal?: number; delivery_cost?: number; status?: OrderStatus; notes?: string | null; accepted_at?: string | null; cancelled_at?: string | null; updated_at?: string }
      >;
      order_items: TableDefinition<
        { id: string; order_id: string; product_id: string | null; category_id: string | null; product_name: string; category_name: string | null; image_url: string | null; is_promotion: boolean; quantity: number; unit_price: number; total: number; note: string | null; created_at: string },
        { id?: string; order_id: string; product_id?: string | null; category_id?: string | null; product_name: string; category_name?: string | null; image_url?: string | null; is_promotion?: boolean; quantity: number; unit_price: number; note?: string | null; created_at?: string },
        { product_id?: string | null; category_id?: string | null; product_name?: string; category_name?: string | null; image_url?: string | null; is_promotion?: boolean; quantity?: number; unit_price?: number; note?: string | null }
      >;
      order_status_history: TableDefinition<
        { id: string; order_id: string; status: OrderStatus; description: string; changed_by: string | null; created_at: string },
        { id?: string; order_id: string; status: OrderStatus; description: string; changed_by?: string | null; created_at?: string },
        { status?: OrderStatus; description?: string; changed_by?: string | null }
      >;
      order_notification_reads: TableDefinition<
        { admin_id: string; order_id: string; read_at: string },
        { admin_id: string; order_id: string; read_at?: string },
        { read_at?: string }
      >;
      audit_logs: TableDefinition<
        { id: number; actor_id: string | null; table_name: string; record_id: string | null; action: string; old_data: Json | null; new_data: Json | null; created_at: string },
        { id?: never; actor_id?: string | null; table_name: string; record_id?: string | null; action: string; old_data?: Json | null; new_data?: Json | null; created_at?: string },
        { actor_id?: string | null; table_name?: string; record_id?: string | null; action?: string; old_data?: Json | null; new_data?: Json | null }
      >;
    };
    Views: {
      sales_ledger: {
        Row: { id: string; order_code: string; customer_name: string; customer_phone: string; delivery_method: DeliveryMethod; payment_method: PaymentMethodCode; subtotal: number; delivery_cost: number; total: number; status: OrderStatus; created_at: string; updated_at: string };
        Relationships: [];
      };
    };
    Functions: {
      create_public_order: { Args: { payload: Json }; Returns: Json };
      sync_product_ingredients: { Args: { target_product_id: string; ingredient_rows?: Json }; Returns: undefined };
      get_dashboard_stats: { Args: { days_back?: number }; Returns: Json };
      is_business_open: { Args: Record<PropertyKey, never>; Returns: boolean };
      calculate_delivery_quote: { Args: { customer_lat: number; customer_lng: number }; Returns: DeliveryQuoteRow[] };
    };
    Enums: {
      app_role: AppRole;
      ingredient_type: IngredientType;
      ingredient_unit: IngredientUnit;
      order_status: OrderStatus;
      delivery_method: DeliveryMethod;
      payment_method_code: PaymentMethodCode;
    };
    CompositeTypes: Record<PropertyKey, never>;
  };
}
