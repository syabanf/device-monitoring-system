-- 0004 seeded three demo technicians with the specialty "Room Alert hardware". The system no
-- longer supports Room Alert units, so their specialty now names the AKCP hardware they service.
-- Only rows that still carry the seeded label change, so an admin's own edit survives.

UPDATE technician SET specialty = 'AKCP hardware'
  WHERE id IN ('tech-001', 'tech-004', 'tech-007') AND specialty = 'Room Alert hardware';
