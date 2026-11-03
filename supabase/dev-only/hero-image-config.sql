-- EXCLUSIVO DEL PROYECTO "chetos-dev". No ejecutar en main / La Central Burger.
-- Campos independientes del logo para permitir pruebas de la imagen principal del hero.
DO $hero_dev$
BEGIN
  IF (SELECT business_name FROM public.business_config WHERE id = 1) IS DISTINCT FROM 'Chetos' THEN
    RAISE EXCEPTION 'Solo se permite modificar la configuración de Chetos DEV';
  END IF;

  ALTER TABLE public.business_config
    ADD COLUMN IF NOT EXISTS hero_image_url text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS hero_image_path text;
END
$hero_dev$;

COMMENT ON COLUMN public.business_config.hero_image_url IS 'URL opcional de la imagen principal del hero; vacío utiliza el logo o el chef por defecto';
COMMENT ON COLUMN public.business_config.hero_image_path IS 'Ruta de la imagen en gallery-images/hero para eliminar archivos reemplazados';
NOTIFY pgrst, 'reload schema';
