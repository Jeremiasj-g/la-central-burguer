# Diagrama entidad–relación

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "extiende"
  PROFILES ||--o{ ORDER_NOTIFICATION_READS : "marca vistos"
  PROFILES ||--o{ ORDER_STATUS_HISTORY : "cambia estado"
  PROFILES ||--o{ AUDIT_LOGS : "ejecuta cambios"

  BUSINESS_CONFIG ||--o{ PAYMENT_METHODS : "configura checkout"

  CATEGORIES ||--o{ PRODUCTS : contiene
  PRODUCTS ||--o{ PRODUCT_INGREDIENTS : compone
  INGREDIENTS ||--o{ PRODUCT_INGREDIENTS : integra

  CUSTOMERS ||--o{ ORDERS : realiza
  ORDERS ||--|{ ORDER_ITEMS : contiene
  PRODUCTS o|--o{ ORDER_ITEMS : "snapshot opcional"
  CATEGORIES o|--o{ ORDER_ITEMS : "snapshot opcional"
  ORDERS ||--o{ ORDER_STATUS_HISTORY : historial
  ORDERS ||--o{ ORDER_NOTIFICATION_READS : lectura

  PROFILES {
    uuid id PK
    app_role role
    boolean active
  }
  BUSINESS_CONFIG {
    smallint id PK
    text business_name
    text whatsapp_number
    boolean is_open
    boolean auto_schedule_enabled
    time auto_open_time
    time auto_close_time
    numeric store_latitude
    numeric store_longitude
    numeric delivery_base_fee
    numeric delivery_price_per_km
  }
  PAYMENT_METHODS {
    uuid id PK
    payment_method_code code UK
    text name
    boolean active
  }
  CATEGORIES {
    uuid id PK
    citext name
    text slug
    integer display_order
    boolean active
    timestamptz deleted_at
  }
  PRODUCTS {
    uuid id PK
    uuid category_id FK
    citext name
    numeric current_price
    boolean active
    boolean available
    boolean featured
    boolean is_promotion
    timestamptz deleted_at
  }
  INGREDIENTS {
    uuid id PK
    citext name
    ingredient_type type
    ingredient_unit unit
    boolean active
    timestamptz deleted_at
  }
  PRODUCT_INGREDIENTS {
    uuid id PK
    uuid product_id FK
    uuid ingredient_id FK
    numeric quantity
    ingredient_unit unit
  }
  CUSTOMERS {
    uuid id PK
    text normalized_phone UK
    text full_name
    integer order_count
    timestamptz last_order_at
  }
  ORDERS {
    uuid id PK
    text order_code UK
    uuid customer_id FK
    delivery_method delivery_method
    payment_method_code payment_method
    numeric subtotal
    numeric delivery_cost
    numeric total
    order_status status
  }
  ORDER_ITEMS {
    uuid id PK
    uuid order_id FK
    uuid product_id FK
    text product_name
    integer quantity
    numeric unit_price
    numeric total
    text note
  }
  ORDER_STATUS_HISTORY {
    uuid id PK
    uuid order_id FK
    order_status status
    uuid changed_by FK
  }
  ORDER_NOTIFICATION_READS {
    uuid admin_id PK,FK
    uuid order_id PK,FK
    timestamptz read_at
  }
  AUDIT_LOGS {
    bigint id PK
    uuid actor_id FK
    text table_name
    text action
    jsonb old_data
    jsonb new_data
  }
```

## Decisiones importantes

- `orders` y `order_items` conservan snapshots para que un cambio posterior de producto no altere ventas anteriores.
- El carrito no se persiste en PostgreSQL: sigue siendo un borrador local hasta confirmar.
- `products`, `categories` e `ingredients` usan baja lógica; sus índices únicos parciales permiten reutilizar nombres después de una eliminación.
- Los pedidos públicos se crean mediante una RPC atómica; el navegador no inserta filas ni define precios directamente.
- `sales_ledger` es una vista administrativa de pedidos no cancelados, no el módulo futuro de reportes/exportaciones.
