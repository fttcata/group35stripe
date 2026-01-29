-- Seed data (events + ticket types)

-- Example: 5 events with ticket types
INSERT INTO events (title, description, date, venue, images)
VALUES
('City Marathon 2026', 'Run through the city landmarks.', '2026-05-15T09:00:00Z', 'City Center', ARRAY['/images/marathon1.jpg']),
('Trail Run Adventure', 'A challenging trail run in the hills.', '2026-06-20T08:00:00Z', 'Hill Park', ARRAY['/images/trail1.jpg','/images/trail2.jpg']),
('5K Charity Fun Run', 'Family-friendly 5K to raise funds.', '2026-04-10T10:00:00Z', 'Community Grounds', ARRAY['/images/5k.jpg']),
('Night Relay', 'Team relay race under lights.', '2026-07-02T20:00:00Z', 'Stadium', ARRAY['/images/relay.jpg']),
('Ultra Endurance Challenge', 'Ultra-distance event for experienced runners.', '2026-08-14T06:00:00Z', 'Lakeside', ARRAY['/images/ultra.jpg']);

-- Ticket types for the events (basic example prices and quantities)
-- The event ids will be taken from the inserted rows; assume small dataset and use subqueries
INSERT INTO ticket_types (event_id, name, price, quantity_available)
SELECT id, 'General Admission', 25.00, 500 FROM events WHERE title = 'City Marathon 2026';

INSERT INTO ticket_types (event_id, name, price, quantity_available)
SELECT id, 'VIP', 80.00, 50 FROM events WHERE title = 'City Marathon 2026';

INSERT INTO ticket_types (event_id, name, price, quantity_available)
SELECT id, 'Trail Entry', 35.00, 300 FROM events WHERE title = 'Trail Run Adventure';

INSERT INTO ticket_types (event_id, name, price, quantity_available)
SELECT id, '5K Adult', 15.00, 400 FROM events WHERE title = '5K Charity Fun Run';

INSERT INTO ticket_types (event_id, name, price, quantity_available)
SELECT id, '5K Child', 8.00, 200 FROM events WHERE title = '5K Charity Fun Run';

INSERT INTO ticket_types (event_id, name, price, quantity_available)
SELECT id, 'Team Relay', 120.00, 80 FROM events WHERE title = 'Night Relay';

INSERT INTO ticket_types (event_id, name, price, quantity_available)
SELECT id, 'Ultra Early Bird', 150.00, 50 FROM events WHERE title = 'Ultra Endurance Challenge';
