-- ============================================================
-- CLEAR & RE-SEED: 30 Irish Sporting Events
-- Run each step in Supabase SQL editor in order.
-- ============================================================

-- STEP 1: Clear existing data (order matters for FK constraints)
DELETE FROM tickets;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM ticket_types;
DELETE FROM events;

-- STEP 2: Insert 30 Irish events
-- All Google Maps URLs use ?q=lat,lng format for reliable coordinate extraction.

-- 1. Sandymount Strand Parkrun 5K
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'Sandymount Strand Parkrun 5K',
  'Free weekly 5K along the Sandymount promenade. Meet at the Martello tower on Strand Road for a 9:30am start. All abilities welcome — walkers, joggers, and runners. Hot tea and biscuits at the finish.',
  '2026-04-05T09:30:00+01:00',
  '2026-04-05T11:00:00+01:00',
  'Running',
  'Sandymount Strand, Dublin 4',
  'https://www.google.com/maps?q=53.3293,-6.2180',
  53.3293, -6.2180,
  ARRAY['https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '28 days'
);

-- 2. Dún Laoghaire Harbour 5K for Pieta House
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'Dún Laoghaire Harbour 5K for Pieta House',
  'Charity 5K loop around Dún Laoghaire harbour raising funds for Pieta House. Flat, scenic route past the East Pier and along Queen''s Road. Chip-timed with a medal and goodie bag for all finishers.',
  '2026-04-12T10:00:00+01:00',
  '2026-04-12T12:00:00+01:00',
  'Running',
  'Dún Laoghaire Harbour, Co. Dublin',
  'https://www.google.com/maps?q=53.2947,-6.1345',
  53.2947, -6.1345,
  ARRAY['https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '25 days'
);

-- 3. Malahide Castle Parkrun 5K
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000003',
  'Malahide Castle Parkrun 5K',
  'Scenic 5K through the grounds of Malahide Castle and Demesne. Two laps on a gravel and tarmac path past the castle walls and the old cricket pitch. Free event — just register on parkrun.ie.',
  '2026-04-12T09:30:00+01:00',
  '2026-04-12T11:00:00+01:00',
  'Running',
  'Malahide Castle, Malahide, Co. Dublin',
  'https://www.google.com/maps?q=53.4449,-6.1627',
  53.4449, -6.1627,
  ARRAY['https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '24 days'
);

-- 4. Phoenix Park 10K for Barretstown
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000004',
  'Phoenix Park 10K for Barretstown',
  'Chip-timed 10K through Phoenix Park raising funds for Barretstown children''s charity. The route passes the Wellington Monument, Áras an Uachtaráin, and the Papal Cross. Post-race refreshments near the Visitor Centre.',
  '2026-04-19T09:00:00+01:00',
  '2026-04-19T12:00:00+01:00',
  'Running',
  'Phoenix Park, Dublin 8',
  'https://www.google.com/maps?q=53.3559,-6.3298',
  53.3559, -6.3298,
  ARRAY['https://images.unsplash.com/photo-1532444458054-01a7dd3e9fca?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '22 days'
);

-- 5. Bray to Greystones Cliff Run 12K
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000005',
  'Bray to Greystones Cliff Run 12K',
  'Point-to-point 12K trail run along the Bray Head cliff walk into Greystones. Stunning views of the Irish Sea but expect steep climbs and uneven ground. Bus transfers back to Bray after the race. Soup and rolls in the Harbour Bar.',
  '2026-04-19T08:30:00+01:00',
  '2026-04-19T12:00:00+01:00',
  'Running',
  'Bray Seafront, Co. Wicklow',
  'https://www.google.com/maps?q=53.1988,-6.0945',
  53.1988, -6.0945,
  ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '20 days'
);

-- 6. Limerick 5K for Milford Hospice
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000006',
  'Limerick 5K for Milford Hospice',
  'Flat 5K along the banks of the Shannon in aid of Milford Hospice. Great one for first-timers. Starts and finishes at Thomond Park with live music and a barbecue afterwards.',
  '2026-04-26T10:00:00+01:00',
  '2026-04-26T12:00:00+01:00',
  'Running',
  'Thomond Park, Limerick',
  'https://www.google.com/maps?q=52.6638,-8.6267',
  52.6638, -8.6267,
  ARRAY['https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '18 days'
);

-- 7. Rathfarnham GAA 7-a-Side
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000007',
  'Rathfarnham GAA 7-a-Side Tournament',
  'Annual 7-a-side football blitz at St Enda''s Park. Teams of 7 plus 3 subs. Round-robin format followed by knockout. Entry includes sandwiches and teas in the clubhouse. All Dublin clubs welcome.',
  '2026-05-03T10:00:00+01:00',
  '2026-05-03T17:00:00+01:00',
  'Football',
  'St Enda''s Park, Rathfarnham, Dublin 16',
  'https://www.google.com/maps?q=53.2928,-6.2899',
  53.2928, -6.2899,
  ARRAY['https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '16 days'
);

-- 8. Cork City 10K
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000008',
  'Cork City 10K',
  'Fast, flat 10K through Cork city centre. Starts at St Patrick''s Street, crosses the River Lee twice, and finishes at Fitzgerald Park. Chip-timed race with pacers for 45, 50, and 55 minutes.',
  '2026-05-10T09:00:00+01:00',
  '2026-05-10T12:00:00+01:00',
  'Running',
  'St Patrick''s Street, Cork',
  'https://www.google.com/maps?q=51.8980,-6.2694',
  51.8980, -6.2694,
  ARRAY['https://images.unsplash.com/photo-1596727362302-b8d891c42ab8?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '14 days'
);

-- 9. Howth Cliff Path Challenge 15K
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000009',
  'Howth Cliff Path Challenge 15K',
  'Challenging 15K around the Howth cliff loop starting from the DART station carpark. Expect exposed coastal paths, a tough climb up to the summit, and views across Dublin Bay. Prizegiving in The Bloody Stream pub afterwards.',
  '2026-05-10T08:00:00+01:00',
  '2026-05-10T12:00:00+01:00',
  'Running',
  'Howth Village, Co. Dublin',
  'https://www.google.com/maps?q=53.3872,-6.0659',
  53.3872, -6.0659,
  ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '12 days'
);

-- 10. Wicklow Mountains Trail Run 20K
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-00000000000a',
  'Wicklow Mountains Trail Run 20K',
  'Off-road 20K through Glendalough and the Wicklow Mountains. The route follows forestry tracks and bog paths with about 600m of elevation gain. Full trail shoes mandatory — no road shoes. Water stations at 8K and 15K.',
  '2026-05-17T08:00:00+01:00',
  '2026-05-17T13:00:00+01:00',
  'Running',
  'Glendalough Visitor Centre, Co. Wicklow',
  'https://www.google.com/maps?q=53.0114,-6.3297',
  53.0114, -6.3297,
  ARRAY['https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '10 days'
);

-- 11. Dollymount Dash for LauraLynn 5K
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-00000000000b',
  'Dollymount Dash for LauraLynn 5K',
  'Charity 5K on the wooden bridge and Bull Island strand raising funds for the LauraLynn children''s hospice. Flat, fast course on a mix of path and compact sand. Family-friendly — bring the buggy. Face painting for the kids.',
  '2026-05-17T10:00:00+01:00',
  '2026-05-17T12:00:00+01:00',
  'Running',
  'Dollymount, Dublin 3',
  'https://www.google.com/maps?q=53.3644,-6.1510',
  53.3644, -6.1510,
  ARRAY['https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '9 days'
);

-- 12. Lucan Sarsfields GAA Fun Run 5K
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-00000000000c',
  'Lucan Sarsfields GAA Fun Run 5K',
  'Club fundraiser 5K around Lucan Demesne and along the Liffey. Starts at the Sarsfields clubhouse. All proceeds go to the underage development squads. Medal for every finisher and a raffle in the clubhouse after.',
  '2026-05-24T10:30:00+01:00',
  '2026-05-24T12:30:00+01:00',
  'Running',
  'Lucan Sarsfields GAA, 12th Lock, Lucan',
  'https://www.google.com/maps?q=53.3539,-6.4488',
  53.3539, -6.4488,
  ARRAY['https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '8 days'
);

-- 13. Waterford Greenway Half Marathon
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-00000000000d',
  'Waterford Greenway Half Marathon',
  'Fast, traffic-free half marathon along the Waterford Greenway from Dungarvan to Kilmacthomas. Runs on a converted railway line through tunnels and over viaducts. Net downhill profile — great for a PB.',
  '2026-05-31T09:00:00+01:00',
  '2026-05-31T13:00:00+01:00',
  'Running',
  'Dungarvan, Co. Waterford',
  'https://www.google.com/maps?q=52.0905,-7.6198',
  52.0905, -7.6198,
  ARRAY['https://images.unsplash.com/photo-1596727362302-b8d891c42ab8?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '7 days'
);

-- 14. Donegal Wild Atlantic Half Marathon
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-00000000000e',
  'Donegal Wild Atlantic Half Marathon',
  'Scenic half marathon along the Wild Atlantic Way from Downings to Carrigart. Exposed, hilly course with Atlantic headwinds guaranteed. Pacers at 1:45 and 2:00. Post-race hot whiskeys and chowder at the Harbour Bar.',
  '2026-06-07T09:00:00+01:00',
  '2026-06-07T13:00:00+01:00',
  'Running',
  'Downings, Co. Donegal',
  'https://www.google.com/maps?q=55.1834,-7.8380',
  55.1834, -7.8380,
  ARRAY['https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '6 days'
);

-- 15. Galway Bay Swim 13K
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-00000000000f',
  'Galway Bay Swim 13K',
  'Ireland''s premier marathon swim across Galway Bay from Aughinish to Blackrock diving tower. Wetsuits permitted. Safety kayakers accompany every three swimmers. You must complete a 5K qualifying swim beforehand.',
  '2026-06-14T07:00:00+01:00',
  '2026-06-14T15:00:00+01:00',
  'Swimming',
  'Salthill, Galway',
  'https://www.google.com/maps?q=53.2568,-9.0828',
  53.2568, -9.0828,
  ARRAY['https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '5 days'
);

-- 16. Connemara 100 Ultra Trail
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000010',
  'Connemara 100 Ultra Trail',
  'Brutal 100K ultra through the Twelve Bens and Connemara bogs. 3,500m elevation gain, mandatory kit check, and a 20-hour cutoff. Not for the faint-hearted. Registration includes a drop bag service and hot food at aid stations.',
  '2026-06-21T06:00:00+01:00',
  '2026-06-22T02:00:00+01:00',
  'Running',
  'Clifden, Co. Galway',
  'https://www.google.com/maps?q=53.4882,-10.0199',
  53.4882, -10.0199,
  ARRAY['https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800&h=500&fit=crop', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '4 days'
);

-- 17. Skerries Half Marathon
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000011',
  'Skerries Half Marathon',
  'Out-and-back half marathon along the coast road from Skerries to Balbriggan and back. Flat and fast with a tailwind expected on the return leg. Post-race pints at Storm in a Teacup or Stoop Your Head.',
  '2026-06-28T09:00:00+01:00',
  '2026-06-28T13:00:00+01:00',
  'Running',
  'Skerries, Co. Dublin',
  'https://www.google.com/maps?q=53.5815,-6.1077',
  53.5815, -6.1077,
  ARRAY['https://images.unsplash.com/photo-1532444458054-01a7dd3e9fca?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '3 days'
);

-- 18. Ring of Kerry Charity Cycle
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000012',
  'Ring of Kerry Charity Cycle',
  '170K cycle around the Ring of Kerry starting and finishing in Killarney. One of Ireland''s biggest sportives with 10,000 riders. All funds go to Kerry charities. Feed stations every 25K with Snickers bars and flat Coke.',
  '2026-07-04T06:00:00+01:00',
  '2026-07-04T18:00:00+01:00',
  'Cycling',
  'Killarney, Co. Kerry',
  'https://www.google.com/maps?q=52.0599,-9.5097',
  52.0599, -9.5097,
  ARRAY['https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800&h=500&fit=crop', 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '2 days'
);

-- 19. Kilkenny All-Ireland Hurling 7s
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000013',
  'Kilkenny All-Ireland Hurling 7s',
  'Prestigious hurling 7-a-side tournament at Nowlan Park. Senior and intermediate grades. Teams from every county are welcome. The atmosphere is unreal — bring a folding chair and a few cans.',
  '2026-07-12T10:00:00+01:00',
  '2026-07-12T18:00:00+01:00',
  'Football',
  'Nowlan Park, Kilkenny',
  'https://www.google.com/maps?q=52.6541,-7.2611',
  52.6541, -7.2611,
  ARRAY['https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '1 day'
);

-- 20. Portmarnock Beach Open Water 1.5K
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000014',
  'Portmarnock Beach Open Water 1.5K',
  'Sheltered 1.5K sea swim off the Velvet Strand in Portmarnock. Wetsuits compulsory if water temperature is below 14°C. Safety boats and shore spotters provided. Great intro to open water. Hot chocolate at the finish.',
  '2026-07-19T11:00:00+01:00',
  '2026-07-19T13:00:00+01:00',
  'Swimming',
  'Velvet Strand, Portmarnock, Co. Dublin',
  'https://www.google.com/maps?q=53.4284,-6.1355',
  53.4284, -6.1355,
  ARRAY['https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&h=500&fit=crop', 'https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '1 day'
);

-- 21. Croagh Patrick Hill Race
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000015',
  'Croagh Patrick Hill Race',
  'Fell race to the summit of Croagh Patrick (764m) and back from Murrisk car park. Steep scree descent — ankle gaiters recommended. Fastest runners complete it in under 30 minutes. Traditional race with over 50 years of history.',
  '2026-07-26T11:00:00+01:00',
  '2026-07-26T15:00:00+01:00',
  'Running',
  'Murrisk, Westport, Co. Mayo',
  'https://www.google.com/maps?q=53.7607,-9.6632',
  53.7607, -9.6632,
  ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '1 day'
);

-- 22. Dollymount 5-a-Side Beach Football
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000016',
  'Dollymount 5-a-Side Beach Football',
  'Beach football tournament on Bull Island. 5-a-side, 10-minute games, round-robin into knockout. Sandy, chaotic, brilliant craic. All proceeds to the Irish Cancer Society. BBQ on the beach after the final.',
  '2026-08-01T11:00:00+01:00',
  '2026-08-01T17:00:00+01:00',
  'Football',
  'Bull Island, Dollymount, Dublin 3',
  'https://www.google.com/maps?q=53.3680,-6.1490',
  53.3680, -6.1490,
  ARRAY['https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '1 day'
);

-- 23. Cobh Heritage 10-Mile Road Race
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000017',
  'Cobh Heritage 10-Mile Road Race',
  'Hilly 10-mile road race through the colourful streets of Cobh town. Starts at the Titanic Memorial, loops around Great Island, and finishes at the old railway station. Chip-timed with prize money for the top three.',
  '2026-08-09T09:30:00+01:00',
  '2026-08-09T12:30:00+01:00',
  'Running',
  'Cobh, Co. Cork',
  'https://www.google.com/maps?q=51.8503,-8.2943',
  51.8503, -8.2943,
  ARRAY['https://images.unsplash.com/photo-1596727362302-b8d891c42ab8?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '1 day'
);

-- 24. Sligo Bay Sprint Triathlon
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000018',
  'Sligo Bay Sprint Triathlon',
  'Sprint triathlon: 750m sea swim, 20K bike, 5K run. Based at Rosses Point with a rolling bike course and a flat run finish along the beach. Relay teams welcome. Triathlon Ireland licence or day licence required.',
  '2026-08-16T08:30:00+01:00',
  '2026-08-16T13:00:00+01:00',
  'Swimming',
  'Rosses Point, Co. Sligo',
  'https://www.google.com/maps?q=54.3046,-8.5651',
  54.3046, -8.5651,
  ARRAY['https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&h=500&fit=crop', 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '1 day'
);

-- 25. Dublin Bay Cycling Sportive 80K
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000019',
  'Dublin Bay Cycling Sportive 80K',
  '80K cycling sportive hugging Dublin Bay from Dún Laoghaire to Howth and back. Two climbs — Killiney Hill and Howth summit. Mechanical support on route. Coffee stop in Howth village. Cycling Ireland insurance required.',
  '2026-08-23T07:30:00+01:00',
  '2026-08-23T13:00:00+01:00',
  'Cycling',
  'Dún Laoghaire, Co. Dublin',
  'https://www.google.com/maps?q=53.2890,-6.1350',
  53.2890, -6.1350,
  ARRAY['https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '1 day'
);

-- 26. Blackrock Charity Sea Swim for Simon Community
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-00000000001a',
  'Blackrock Charity Sea Swim for Simon Community',
  '1K sea swim off the Blackrock baths in aid of the Simon Community. Swimmers can do one or two laps of the marked course. Wetsuits optional but recommended. Warm showers and hot port at the finish.',
  '2026-08-30T10:00:00+01:00',
  '2026-08-30T12:30:00+01:00',
  'Swimming',
  'Blackrock Baths, Blackrock, Co. Dublin',
  'https://www.google.com/maps?q=53.3018,-6.1784',
  53.3018, -6.1784,
  ARRAY['https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '1 day'
);

-- 27. Clontarf GAA 5-a-Side Blitz
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-00000000001b',
  'Clontarf GAA 5-a-Side Blitz',
  'Mixed 5-a-side Gaelic football blitz in St Anne''s Park. Round-robin groups followed by a plate and cup competition. Open to all northside clubs. Entry fee covers a jersey and post-match pizza in the pavilion.',
  '2026-09-06T10:00:00+01:00',
  '2026-09-06T17:00:00+01:00',
  'Football',
  'St Anne''s Park, Clontarf, Dublin 3',
  'https://www.google.com/maps?q=53.3633,-6.2039',
  53.3633, -6.2039,
  ARRAY['https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '1 day'
);

-- 28. Celbridge Heritage 10K
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-00000000001c',
  'Celbridge Heritage 10K',
  'Scenic 10K through Castletown Demesne and along the banks of the Liffey in Celbridge. Mixed terrain — gravel, grass, and a short road section. A lovely course that''s surprisingly hilly near the old mill.',
  '2026-09-13T09:30:00+01:00',
  '2026-09-13T12:00:00+01:00',
  'Running',
  'Castletown House, Celbridge, Co. Kildare',
  'https://www.google.com/maps?q=53.3390,-6.5425',
  53.3390, -6.5425,
  ARRAY['https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '1 day'
);

-- 29. Trim Castle Half Marathon
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-00000000001d',
  'Trim Castle Half Marathon',
  'Half marathon starting at the foot of Trim Castle on the banks of the Boyne. Flat route along country roads through the Meath countryside. Pace groups at 1:40, 1:50, and 2:00. Medal, t-shirt, and a pint token for all finishers.',
  '2026-09-20T09:00:00+01:00',
  '2026-09-20T13:00:00+01:00',
  'Running',
  'Trim Castle, Trim, Co. Meath',
  'https://www.google.com/maps?q=53.5555,-6.7888',
  53.5555, -6.7888,
  ARRAY['https://images.unsplash.com/photo-1532444458054-01a7dd3e9fca?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '1 day'
);

-- 30. Dublin City Marathon 2026
INSERT INTO events (id, title, description, start_date, end_time, sport_category, venue, location_url, lat, lng, images, status, created_at)
VALUES (
  'b0000000-0000-0000-0000-00000000001e',
  'Dublin City Marathon 2026',
  'The big one — 26.2 miles through the streets of Dublin. Starts on Fitzwilliam Street, through the Phoenix Park, past Kilmainham Gaol, and finishes on Merrion Square. 22,500 entries sell out every year. Chip-timed with pacers from 3:00 to 5:30.',
  '2026-10-25T09:00:00+01:00',
  '2026-10-25T16:00:00+01:00',
  'Running',
  'Merrion Square, Dublin 2',
  'https://www.google.com/maps?q=53.3387,-6.2488',
  53.3387, -6.2488,
  ARRAY['https://images.unsplash.com/photo-1532444458054-01a7dd3e9fca?w=800&h=500&fit=crop', 'https://images.unsplash.com/photo-1596727362302-b8d891c42ab8?w=800&h=500&fit=crop'],
  'published',
  NOW() - INTERVAL '30 days'
);


-- STEP 3: Insert ticket types for each event

-- 1. Sandymount Strand Parkrun 5K — free but optional donation
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Free Entry', 0, 200),
  ('b0000000-0000-0000-0000-000000000001', 'Donation (€5)', 5, 100);

-- 2. Dún Laoghaire 5K for Pieta House
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000002', 'General', 12, 500),
  ('b0000000-0000-0000-0000-000000000002', 'Student', 8, 150);

-- 3. Malahide Castle Parkrun 5K
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000003', 'General', 12, 300),
  ('b0000000-0000-0000-0000-000000000003', 'Under 16', 5, 100);

-- 4. Phoenix Park 10K for Barretstown
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000004', 'General Entry', 18, 800),
  ('b0000000-0000-0000-0000-000000000004', 'Student / OAP', 12, 200);

-- 5. Bray to Greystones Cliff Run
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000005', 'General', 18, 250),
  ('b0000000-0000-0000-0000-000000000005', 'Student', 12, 80);

-- 6. Limerick 5K for Milford Hospice
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000006', 'General', 8, 400),
  ('b0000000-0000-0000-0000-000000000006', 'Family (2 adults + 2 kids)', 20, 100);

-- 7. Rathfarnham GAA 7-a-Side
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000007', 'Team Entry (10 players)', 50, 24),
  ('b0000000-0000-0000-0000-000000000007', 'Spectator', 5, 200);

-- 8. Cork City 10K
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000008', 'General', 22, 2000),
  ('b0000000-0000-0000-0000-000000000008', 'Student', 15, 500);

-- 9. Howth Cliff Path Challenge 15K
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000009', 'General', 18, 200),
  ('b0000000-0000-0000-0000-000000000009', 'Pair Entry', 30, 50);

-- 10. Wicklow Mountains Trail Run 20K
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-00000000000a', 'General', 25, 300),
  ('b0000000-0000-0000-0000-00000000000a', 'Early Bird', 20, 100);

-- 11. Dollymount Dash for LauraLynn 5K
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-00000000000b', 'Adult', 10, 300),
  ('b0000000-0000-0000-0000-00000000000b', 'Child (under 12)', 3, 150);

-- 12. Lucan Sarsfields Fun Run 5K
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-00000000000c', 'General', 8, 250);

-- 13. Waterford Greenway Half Marathon
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-00000000000d', 'General', 28, 1500),
  ('b0000000-0000-0000-0000-00000000000d', 'Early Bird', 22, 500);

-- 14. Donegal Wild Atlantic Half Marathon
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-00000000000e', 'Half Marathon', 35, 600),
  ('b0000000-0000-0000-0000-00000000000e', '10K Option', 22, 300);

-- 15. Galway Bay Swim 13K
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-00000000000f', 'Solo Swimmer', 75, 120),
  ('b0000000-0000-0000-0000-00000000000f', 'Relay Team (3)', 120, 40);

-- 16. Connemara 100 Ultra Trail
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000010', '100K Ultra', 70, 200),
  ('b0000000-0000-0000-0000-000000000010', '50K Option', 45, 150);

-- 17. Skerries Half Marathon
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000011', 'General', 30, 800),
  ('b0000000-0000-0000-0000-000000000011', 'Student', 22, 200);

-- 18. Ring of Kerry Charity Cycle
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000012', 'General', 55, 10000);

-- 19. Kilkenny All-Ireland Hurling 7s
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000013', 'Senior Team Entry', 60, 32),
  ('b0000000-0000-0000-0000-000000000013', 'Intermediate Team Entry', 40, 32),
  ('b0000000-0000-0000-0000-000000000013', 'Spectator', 8, 500);

-- 20. Portmarnock Beach Open Water 1.5K
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000014', 'General', 20, 200);

-- 21. Croagh Patrick Hill Race
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000015', 'General', 15, 300);

-- 22. Dollymount 5-a-Side Beach Football
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000016', 'Team Entry (8 players)', 40, 20),
  ('b0000000-0000-0000-0000-000000000016', 'Spectator', 3, 200);

-- 23. Cobh Heritage 10-Mile
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000017', 'General', 22, 400);

-- 24. Sligo Bay Sprint Triathlon
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000018', 'Individual', 45, 250),
  ('b0000000-0000-0000-0000-000000000018', 'Relay Team (3)', 60, 50);

-- 25. Dublin Bay Cycling Sportive 80K
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-000000000019', 'General', 35, 500),
  ('b0000000-0000-0000-0000-000000000019', 'Early Bird', 28, 150);

-- 26. Blackrock Charity Sea Swim
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-00000000001a', 'General', 20, 150);

-- 27. Clontarf GAA 5-a-Side Blitz
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-00000000001b', 'Team Entry (8 players)', 40, 16),
  ('b0000000-0000-0000-0000-00000000001b', 'Spectator', 3, 150);

-- 28. Celbridge Heritage 10K
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-00000000001c', 'General', 20, 500),
  ('b0000000-0000-0000-0000-00000000001c', 'Student', 12, 150);

-- 29. Trim Castle Half Marathon
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-00000000001d', 'General', 32, 1000),
  ('b0000000-0000-0000-0000-00000000001d', 'Early Bird', 25, 300);

-- 30. Dublin City Marathon 2026
INSERT INTO ticket_types (event_id, name, price, quantity) VALUES
  ('b0000000-0000-0000-0000-00000000001e', 'General Entry', 85, 20000),
  ('b0000000-0000-0000-0000-00000000001e', 'Early Bird', 65, 2500);


-- ============================================================
-- STEP 4: Assign all seed events to your organizer account
-- ============================================================
-- Replace with your actual user id if different.

UPDATE events
SET created_by = (SELECT id FROM profiles WHERE email = 'isaac.tuite@gmail.com' LIMIT 1)
WHERE id::text LIKE 'b0000000-0000-0000-0000-0000000000%';
