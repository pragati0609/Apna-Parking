-- =============================================================================
-- APNA PARKING - LIVE MANAGER DEMO PLAYBOOK
-- Step-by-step executable script with sample data for live demonstration
-- =============================================================================

USE ApnaParking;

-- =============================================================================
-- STEP 1: INITIALIZE SCHEMA & SEED DEMO DATA
-- What to say: "Let's first ensure our 3NF schema is ready and insert clean sample data."
-- =============================================================================

-- 1.1 Insert Locations (3NF Normalized)
INSERT INTO Locations (location_id, location_name, address, city, state, postal_code, hourly_rate)
VALUES 
(1, 'Downtown Central Garage', '100 Main St', 'Mumbai', 'Maharashtra', '400001', 60.00),
(2, 'Tech Park Plaza', '45 IT Highway', 'Bengaluru', 'Karnataka', '560100', 40.00)
ON DUPLICATE KEY UPDATE hourly_rate=VALUES(hourly_rate);

-- 1.2 Insert Users
INSERT INTO Users (user_id, full_name, email, phone_number, password_hash)
VALUES
(1, 'Rahul Sharma', 'rahul@example.com', '9876543210', 'scrypt:32768:8:1$XYMqq1LRQuh1xT1c$f0beabfa03cdc91086be91c12f3fdc0df69c7bb5a0bfbb3048eec64b49ee47492bf4d63a70a14511c77e4277cd0eea9f1aebd57c8a05bbc9f77fd06906d3d125'),
(2, 'Priya Patel', 'priya@example.com', '9876543211', 'scrypt:32768:8:1$XYMqq1LRQuh1xT1c$f0beabfa03cdc91086be91c12f3fdc0df69c7bb5a0bfbb3048eec64b49ee47492bf4d63a70a14511c77e4277cd0eea9f1aebd57c8a05bbc9f77fd06906d3d125'),
(3, 'Amit Verma', 'amit@example.com', '9876543212', 'scrypt:32768:8:1$XYMqq1LRQuh1xT1c$f0beabfa03cdc91086be91c12f3fdc0df69c7bb5a0bfbb3048eec64b49ee47492bf4d63a70a14511c77e4277cd0eea9f1aebd57c8a05bbc9f77fd06906d3d125')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);

-- 1.3 Insert Vehicles (Indian Registration Format: e.g. MH12AB1234 & TwoWheeler/FourWheeler only)
INSERT INTO Vehicles (vehicle_id, user_id, license_plate, vehicle_type, make_model)
VALUES
(1, 1, 'MH12AB1234', 'FourWheeler', 'Honda City'),
(2, 2, 'KA03CD5678', 'FourWheeler', 'Hyundai Creta'),
(3, 3, 'DL01EF9012', 'TwoWheeler', 'Ather 450X')
ON DUPLICATE KEY UPDATE make_model=VALUES(make_model);

-- 1.4 Insert Parking Spaces (Slots)
INSERT INTO ParkingSpaces (parking_id, location_id, space_number, space_type, is_active)
VALUES
(1, 1, 'A-101', 'Standard', TRUE),
(2, 1, 'A-102', 'Compact', TRUE),
(3, 1, 'A-103', 'EV_Charging', TRUE),
(4, 2, 'B-201', 'Standard', TRUE),
(5, 2, 'B-202', 'Compact', TRUE)
ON DUPLICATE KEY UPDATE space_number=VALUES(space_number);


-- =============================================================================
-- STEP 2: DEMONSTRATING SAFE DUPLICATE DATA REMOVAL
-- What to say: "Here is our 4-step safe deduplication protocol without risking data loss."
-- =============================================================================

-- 2.1 Check for duplicate emails (Preview)
SELECT LOWER(TRIM(email)) AS email, COUNT(*) AS occurrences 
FROM Users 
GROUP BY LOWER(TRIM(email)) 
HAVING COUNT(*) > 1;

-- 2.2 Re-point child foreign keys before deleting duplicate users
UPDATE Bookings b
JOIN (
    SELECT user_id, MIN(user_id) OVER(PARTITION BY LOWER(TRIM(email))) AS master_id
    FROM Users
) u ON b.user_id = u.user_id
SET b.user_id = u.master_id
WHERE b.user_id <> u.master_id;


-- =============================================================================
-- STEP 3: DEMONSTRATING DOUBLE-BOOKING PREVENTION (CONCURRENCY CONTROL)
-- What to say: "Now we test our CreateBookingSafe stored procedure to prove that double booking is physically blocked."
-- =============================================================================

-- 3.1 Book Slot 1 from 10:00 to 13:00 (Should SUCCEED)
CALL CreateBookingSafe(
    1,                       -- user_id (Rahul)
    1,                       -- vehicle_id (Honda City)
    1,                       -- parking_id (Slot A-101)
    '2026-09-02 10:00:00',   -- start_time
    '2026-09-02 13:00:00',   -- end_time
    @bid,
    @msg
);
SELECT @bid AS booking_id, @msg AS status_message;

-- 3.2 Try to book the SAME Slot 1 with an overlapping time: 11:00 to 14:00 (Should FAIL & BLOCK)
-- What to say: "Notice that our procedure detects the overlap and rejects the double booking with a clear message."
CALL CreateBookingSafe(
    2,                       -- user_id (Priya)
    2,                       -- vehicle_id (Hyundai Creta)
    1,                       -- parking_id (Slot A-101 - Already booked!)
    '2026-09-02 11:00:00',   -- start_time (Overlaps with 10:00 - 13:00)
    '2026-09-02 14:00:00',   -- end_time
    @bid,
    @msg
);
SELECT @bid AS booking_id, @msg AS status_message;

-- 3.3 Book Slot 1 AFTER 13:00 on the same day (Should SUCCEED because no overlap)
CALL CreateBookingSafe(
    3,                       -- user_id (Amit)
    3,                       -- vehicle_id (Tata Nexon EV / Ather 450X)
    1,                       -- parking_id (Slot A-101)
    '2026-09-02 14:00:00',   -- start_time (Starts after previous booking ends)
    '2026-09-02 17:00:00',   -- end_time
    @bid,
    @msg
);
SELECT @bid AS booking_id, @msg AS status_message;


-- =============================================================================
-- STEP 4: DEMONSTRATING CANCELLATION & AUDIT LOGGING
-- What to say: "When a booking is cancelled, we update the status and immediately log it into the Cancellations audit table."
-- =============================================================================

-- 4.1 Cancel Booking #1
CALL CancelBookingWithAudit(1, 1, 'User requested cancellation', @cancel_msg);
SELECT @cancel_msg AS status_message;

-- 4.2 Verify the Audit Trail in Cancellations table
-- What to say: "Here we can inspect the audit record showing who cancelled it, the timestamp, and refund amount."
SELECT 
    c.cancellation_id,
    c.booking_id,
    u.full_name AS cancelled_by,
    c.cancellation_reason,
    c.refund_amount,
    c.cancelled_at
FROM Cancellations c
JOIN Users u ON c.cancelled_by_user_id = u.user_id;


-- =============================================================================
-- STEP 5: REAL-TIME AVAILABILITY & OCCUPANCY QUERIES
-- What to say: "Lastly, we run our dynamic date/time availability and business analytics queries."
-- =============================================================================

-- 5.1 Real-Time Slot Availability for a specific window
-- Find slots available at Location 1 between 10:00 and 13:00 on 2026-09-02
SELECT 
    ps.parking_id,
    ps.space_number,
    ps.space_type,
    l.location_name,
    l.hourly_rate
FROM ParkingSpaces ps
JOIN Locations l ON ps.location_id = l.location_id
WHERE ps.location_id = 1
  AND ps.is_active = TRUE
  AND ps.parking_id NOT IN (
      SELECT b.parking_id
      FROM Bookings b
      WHERE b.status IN ('Pending', 'Confirmed')
        AND b.start_time < '2026-09-02 13:00:00'
        AND b.end_time   > '2026-09-02 10:00:00'
  );

-- 5.2 Real-Time Occupancy Summary Across Locations
SELECT 
    l.location_name,
    l.city,
    COUNT(ps.parking_id) AS total_spaces,
    COUNT(DISTINCT active_b.parking_id) AS occupied_spaces,
    (COUNT(ps.parking_id) - COUNT(DISTINCT active_b.parking_id)) AS available_spaces,
    ROUND(
        (COUNT(DISTINCT active_b.parking_id) * 100.0) / NULLIF(COUNT(ps.parking_id), 0),
        2
    ) AS occupancy_rate_pct
FROM Locations l
JOIN ParkingSpaces ps ON l.location_id = ps.location_id AND ps.is_active = TRUE
LEFT JOIN Bookings active_b 
    ON ps.parking_id = active_b.parking_id
   AND active_b.status = 'Confirmed'
   AND NOW() BETWEEN active_b.start_time AND active_b.end_time
GROUP BY l.location_id, l.location_name, l.city;

-- 5.3 Daily Bookings Breakdown
SELECT 
    DATE(b.start_time) AS booking_date,
    COUNT(b.booking_id) AS total_bookings,
    SUM(CASE WHEN b.status = 'Confirmed' THEN 1 ELSE 0 END) AS confirmed,
    SUM(CASE WHEN b.status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled
FROM Bookings b
GROUP BY DATE(b.start_time)
ORDER BY booking_date DESC;