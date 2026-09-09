-- ATH-ADMIN-003: align persistence with frozen product_event.v1 string event_id.
ALTER TABLE ath_product_events ALTER COLUMN event_id TYPE TEXT USING event_id::text;
ALTER TABLE ath_product_events ADD CONSTRAINT ath_product_events_event_id_check CHECK (char_length(event_id) BETWEEN 1 AND 80);
