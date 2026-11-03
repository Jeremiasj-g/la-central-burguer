-- Inicialización de identidad en el proyecto CHE TOS DEV únicamente.
-- La condición evita sobreescribir futuras ediciones hechas desde Configuración.
UPDATE public.business_config
SET business_name = 'Chetos',
    hero_description = 'Hamburguesas, lomitos, pizzas y mucho más. Elegí tu favorito, armá tu pedido y disfrutá.',
    logo_url = '',
    logo_path = NULL
WHERE id = 1
  AND business_name = 'La Central Burger';
