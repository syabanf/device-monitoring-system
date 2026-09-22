-- 0004 seeded four outlets with coordinates near 0,0: the fixture generator divided the city
-- centre by 1000 along with the random offset. The generator now keeps the centre, and this
-- moves those rows to the regenerated values from packages/fixtures.
--
-- Each UPDATE matches the old lat and lng too, so an outlet an admin has already moved keeps
-- its edited location.

UPDATE outlet SET lat = -7.30426, lng = 112.71453, maps_url = 'https://maps.google.com/?q=-7.30426,112.71453'
  WHERE id = 'out-001' AND lat = -0.05403 AND lng = 0.07517;
UPDATE outlet SET lat = -7.23265, lng = 112.76687, maps_url = 'https://maps.google.com/?q=-7.23265,112.76687'
  WHERE id = 'out-002' AND lat = 0.01757 AND lng = 0.12751;
UPDATE outlet SET lat = -6.15055, lng = 106.93559, maps_url = 'https://maps.google.com/?q=-6.15055,106.93559'
  WHERE id = 'out-021' AND lat = -0.03528 AND lng = 0.16586;
UPDATE outlet SET lat = -8.6326, lng = 115.16313, maps_url = 'https://maps.google.com/?q=-8.6326,115.16313'
  WHERE id = 'out-028' AND lat = 0.02923 AND lng = 0.06574;
