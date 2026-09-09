DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM ath_product_events WHERE event_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'Cannot restore UUID event_id while non-UUID product_event.v1 IDs exist';
  END IF;
END $$;
ALTER TABLE ath_product_events DROP CONSTRAINT IF EXISTS ath_product_events_event_id_check;
ALTER TABLE ath_product_events ALTER COLUMN event_id TYPE UUID USING event_id::uuid;
