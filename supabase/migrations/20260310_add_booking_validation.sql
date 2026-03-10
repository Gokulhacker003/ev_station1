-- Add backend validation for booking slots to prevent double-booking

-- Create unique constraint to prevent duplicate bookings for same slot/station/date
-- Note: We can't use a simple UNIQUE constraint because cancelled bookings should not count
-- Instead, we'll use a partial unique index

-- Drop existing index if any
DROP INDEX IF EXISTS idx_unique_active_booking;

-- Create partial unique index that only applies to non-cancelled bookings
CREATE UNIQUE INDEX idx_unique_active_booking 
ON public.bookings (station_id, booking_date, time_slot)
WHERE status != 'cancelled';

-- Create function to validate booking before insert/update
CREATE OR REPLACE FUNCTION public.validate_booking()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- Only validate if status is not cancelled
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Check if there's already an active booking for this slot
  SELECT COUNT(*) INTO existing_count
  FROM public.bookings
  WHERE station_id = NEW.station_id
    AND booking_date = NEW.booking_date
    AND time_slot = NEW.time_slot
    AND status != 'cancelled'
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF existing_count > 0 THEN
    RAISE EXCEPTION 'This time slot is already booked for the selected station and date';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run validation before insert or update
DROP TRIGGER IF EXISTS trigger_validate_booking ON public.bookings;
CREATE TRIGGER trigger_validate_booking
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking();

-- Add comment for documentation
COMMENT ON FUNCTION public.validate_booking() IS 
  'Validates that a booking slot is not already taken before allowing insert/update. Prevents double-booking at database level.';
