-- Jalankan SEMUA blok ini di Supabase SQL Editor (project hostinganteamorders).
-- Tujuan: setel ulang sequence id ke MAX(id) setelah migrasi insert eksplisit.
DO $$
DECLARE t text; seq text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','action_items','activity_log','calendar_tokens','compost_buckets','customers','inventory_items','journal_entries','journal_entry_lines','meeting_note_attendees','meeting_notes','notifications','payout_members','payouts','points_transactions','products','project_members','project_templates','projects','qr_codes','redemptions','rewards','sale_items','sales','site_content','stock_movements','tasks','team_members','track_record_activities','transactions','users','waste_stats'] LOOP
    seq := pg_get_serial_sequence(t, 'id');
    IF seq IS NOT NULL THEN
      EXECUTE format('SELECT setval(%L, GREATEST((SELECT COALESCE(MAX(id), 1) FROM %I), 1))', seq, t);
    END IF;
  END LOOP;
  RAISE NOTICE 'setval selesai';
END $$;
