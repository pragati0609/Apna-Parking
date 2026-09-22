-- =============================================================================
-- APNA PARKING - ENTERPRISE DATABASE SOLUTION
-- Version: 2.0 (Normalized to 3NF, Concurrency-Safe, Audit-Enabled)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS ApnaParking;
USE ApnaParking;

-- =============================================================================
-- SECTION 1: 3NF SCHEMA DEFINITION & CONSTRAINTS
-- =============================================================================

-- 1.1 Locations / Parking Lots Table
-- Normalizes location data (eliminates transitive dependencies from ParkingSpaces)
CREATE TABLE IF NOT EXISTS Locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    location_name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(50) NOT NULL,
    state VARCHAR(50) NOT NULL,
    postal_code VARCHAR(20),
    hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 50.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_location_name_city UNIQUE (location_name, city)
) ENGINE=InnoDB;

-- 1.2 Users Table
CREATE TABLE IF NOT EXISTS Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 1.3 Vehicles Table (Indian License Plate Format & 2-Wheeler/4-Wheeler only)
CREATE TABLE IF NOT EXISTS Vehicles (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    license_plate VARCHAR(20) NOT NULL UNIQUE,
    vehicle_type ENUM('TwoWheeler', 'FourWheeler') NOT NULL DEFAULT 'FourWheeler',
    make_model VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_indian_license_plate CHECK (
        license_plate REGEXP '^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$'
    ),
    CONSTRAINT fk_vehicle_user FOREIGN KEY (user_id) 
        REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_vehicle_user_id ON Vehicles (user_id);

-- 1.4 Parking Spaces (Slots) Table
CREATE TABLE IF NOT EXISTS ParkingSpaces (
    parking_id INT AUTO_INCREMENT PRIMARY KEY,
    location_id INT NOT NULL,
    space_number VARCHAR(20) NOT NULL,
    space_type ENUM('Standard', 'Compact', 'EV_Charging', 'Handicapped') NOT NULL DEFAULT 'Standard',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_location_space UNIQUE (location_id, space_number),
    CONSTRAINT fk_parkingspace_location FOREIGN KEY (location_id) 
        REFERENCES Locations(location_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 1.5 Bookings Table
CREATE TABLE IF NOT EXISTS Bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    parking_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Confirmed',
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_booking_time CHECK (start_time < end_time),
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) 
        REFERENCES Users(user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_vehicle FOREIGN KEY (vehicle_id) 
        REFERENCES Vehicles(vehicle_id) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_space FOREIGN KEY (parking_id) 
        REFERENCES ParkingSpaces(parking_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Indexing for high performance conflict checking & analytics
CREATE INDEX idx_booking_slot_time_status ON Bookings (parking_id, status, start_time, end_time);
CREATE INDEX idx_booking_user_status ON Bookings (user_id, status);

-- 1.6 Cancellations Audit Table
CREATE TABLE IF NOT EXISTS Cancellations (
    cancellation_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    cancelled_by_user_id INT NOT NULL,
    cancellation_reason VARCHAR(255) DEFAULT 'User requested cancellation',
    refund_amount DECIMAL(10, 2) DEFAULT 0.00,
    cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cancel_booking FOREIGN KEY (booking_id) 
        REFERENCES Bookings(booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_cancel_user FOREIGN KEY (cancelled_by_user_id) 
        REFERENCES Users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 1.7 Payments Table
CREATE TABLE IF NOT EXISTS Payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_status ENUM('Pending', 'Successful', 'Failed', 'Refunded') NOT NULL DEFAULT 'Successful',
    payment_method ENUM('Card', 'UPI', 'NetBanking', 'Cash', 'Wallet') NOT NULL DEFAULT 'UPI',
    transaction_ref VARCHAR(100),
    razorpay_order_id VARCHAR(100) UNIQUE NULL,
    razorpay_payment_id VARCHAR(100) NULL,
    razorpay_signature VARCHAR(255) NULL,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) 
        REFERENCES Bookings(booking_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_payment_booking_status ON Payments (booking_id, payment_status);


-- =============================================================================
-- SECTION 2: SAFE DATA DEDUPLICATION PROCEDURE (PRODUCTION PROTOCOL)
-- =============================================================================

DROP PROCEDURE IF EXISTS DeduplicateUsers;

DELIMITER //

CREATE PROCEDURE DeduplicateUsers()
BEGIN
    -- Step 2.1: Create shadow backup tables before deduplication
    CREATE TABLE IF NOT EXISTS Users_Backup LIKE Users;
    INSERT IGNORE INTO Users_Backup SELECT * FROM Users;

    CREATE TABLE IF NOT EXISTS Vehicles_Backup LIKE Vehicles;
    INSERT IGNORE INTO Vehicles_Backup SELECT * FROM Vehicles;

    CREATE TABLE IF NOT EXISTS Bookings_Backup LIKE Bookings;
    INSERT IGNORE INTO Bookings_Backup SELECT * FROM Bookings;

    -- Step 2.2: Re-map Foreign Keys for duplicate users (by email) to master ID
    UPDATE Bookings b
    JOIN (
        SELECT user_id, MIN(user_id) OVER(PARTITION BY LOWER(TRIM(email))) AS master_id
        FROM Users
    ) u ON b.user_id = u.user_id
    SET b.user_id = u.master_id
    WHERE b.user_id <> u.master_id;

    UPDATE Vehicles v
    JOIN (
        SELECT user_id, MIN(user_id) OVER(PARTITION BY LOWER(TRIM(email))) AS master_id
        FROM Users
    ) u ON v.user_id = u.user_id
    SET v.user_id = u.master_id
    WHERE v.user_id <> u.master_id;

    -- Step 2.3: Safely delete duplicate user rows (keeping earliest ID)
    DELETE FROM Users
    WHERE user_id IN (
        SELECT user_id FROM (
            SELECT user_id,
                   ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(email)) ORDER BY user_id ASC) AS rn
            FROM Users
        ) t
        WHERE t.rn > 1
    );
END //

DELIMITER ;


-- =============================================================================
-- SECTION 3: STORED PROCEDURES (CONCURRENCY-SAFE BOOKING & CANCELLATION)
-- =============================================================================

DROP PROCEDURE IF EXISTS CreateBookingSafe;
DROP PROCEDURE IF EXISTS CancelBookingWithAudit;

DELIMITER //

-- 3.1 Concurrency-Safe Booking Creation (Prevents Double Booking)
CREATE PROCEDURE CreateBookingSafe(
    IN p_user_id INT,
    IN p_vehicle_id INT,
    IN p_parking_id INT,
    IN p_start_time DATETIME,
    IN p_end_time DATETIME,
    OUT p_booking_id INT,
    OUT p_message VARCHAR(255)
)
proc_label: BEGIN
    DECLARE v_conflict_count INT DEFAULT 0;
    DECLARE v_hourly_rate DECIMAL(10, 2) DEFAULT 0.00;
    DECLARE v_duration_hours DECIMAL(10, 2) DEFAULT 0.00;
    DECLARE v_total_amount DECIMAL(10, 2) DEFAULT 0.00;
    DECLARE v_is_active BOOLEAN;

    -- Rollback automatically if any unexpected SQL error occurs
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_booking_id = NULL;
        SET p_message = 'Error: An internal database error occurred while creating the booking.';
    END;

    -- Basic time validation
    IF p_start_time >= p_end_time THEN
        SET p_booking_id = NULL;
        SET p_message = 'Error: start_time must be strictly before end_time.';
        LEAVE proc_label;
    END IF;

    -- Verify user exists
    IF NOT EXISTS (SELECT 1 FROM Users WHERE user_id = p_user_id) THEN
        SET p_booking_id = NULL;
        SET p_message = 'Error: User does not exist.';
        LEAVE proc_label;
    END IF;

    -- Verify vehicle belongs to user
    IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE vehicle_id = p_vehicle_id AND user_id = p_user_id) THEN
        SET p_booking_id = NULL;
        SET p_message = 'Error: Vehicle does not exist or does not belong to user.';
        LEAVE proc_label;
    END IF;

    -- Verify space existence and active status
    SELECT ps.is_active, l.hourly_rate
    INTO v_is_active, v_hourly_rate
    FROM ParkingSpaces ps
    JOIN Locations l ON ps.location_id = l.location_id
    WHERE ps.parking_id = p_parking_id;

    IF v_is_active IS NULL OR v_is_active = FALSE THEN
        SET p_booking_id = NULL;
        SET p_message = 'Error: Parking slot is inactive or does not exist.';
        LEAVE proc_label;
    END IF;

    -- Calculate amount based on duration in hours (minimum 1 hour)
    SET v_duration_hours = GREATEST(1.0, TIMESTAMPDIFF(MINUTE, p_start_time, p_end_time) / 60.0);
    SET v_total_amount = ROUND(v_duration_hours * v_hourly_rate, 2);

    -- Begin transaction with pessimistic lock check
    START TRANSACTION;

    SELECT COUNT(*)
    INTO v_conflict_count
    FROM Bookings
    WHERE parking_id = p_parking_id
      AND status IN ('Pending', 'Confirmed')
      AND start_time < p_end_time
      AND end_time > p_start_time
    FOR UPDATE;

    IF v_conflict_count > 0 THEN
        ROLLBACK;
        SET p_booking_id = NULL;
        SET p_message = 'Conflict: Parking slot is already booked for the requested time slot.';
    ELSE
        INSERT INTO Bookings (
            user_id,
            vehicle_id,
            parking_id,
            start_time,
            end_time,
            status,
            total_amount
        )
        VALUES (
            p_user_id,
            p_vehicle_id,
            p_parking_id,
            p_start_time,
            p_end_time,
            'Confirmed',
            v_total_amount
        );

        SET p_booking_id = LAST_INSERT_ID();
        SET p_message = 'Success: Booking created successfully.';
        COMMIT;
    END IF;

END proc_label //


-- 3.2 Cancel Booking with Audit Logging
CREATE PROCEDURE CancelBookingWithAudit(
    IN p_booking_id INT,
    IN p_cancelled_by_user_id INT,
    IN p_reason VARCHAR(255),
    OUT p_message VARCHAR(255)
)
proc_label: BEGIN
    DECLARE v_current_status VARCHAR(20);
    DECLARE v_paid_amount DECIMAL(10, 2) DEFAULT 0.00;

    -- Rollback automatically if any unexpected SQL error occurs
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_message = 'Error: An internal database error occurred while cancelling the booking.';
    END;

    -- Begin transaction before status read to lock the booking row
    START TRANSACTION;

    SELECT status INTO v_current_status
    FROM Bookings
    WHERE booking_id = p_booking_id
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        ROLLBACK;
        SET p_message = 'Error: Booking ID does not exist.';
        LEAVE proc_label;
    ELSEIF v_current_status = 'Cancelled' THEN
        ROLLBACK;
        SET p_message = 'Notice: Booking is already cancelled.';
        LEAVE proc_label;
    ELSEIF v_current_status = 'Completed' THEN
        ROLLBACK;
        SET p_message = 'Error: Completed bookings cannot be cancelled.';
        LEAVE proc_label;
    END IF;

    -- Fetch paid amount for refund calculation if applicable
    SELECT IFNULL(SUM(amount), 0.00) INTO v_paid_amount
    FROM Payments
    WHERE booking_id = p_booking_id AND payment_status = 'Successful';

    -- Update booking status
    UPDATE Bookings
    SET status = 'Cancelled'
    WHERE booking_id = p_booking_id;

    -- Log cancellation to audit table
    INSERT INTO Cancellations (
        booking_id,
        cancelled_by_user_id,
        cancellation_reason,
        refund_amount,
        cancelled_at
    )
    VALUES (
        p_booking_id,
        p_cancelled_by_user_id,
        IFNULL(p_reason, 'User initiated cancellation'),
        v_paid_amount,
        NOW()
    );

    COMMIT;
    SET p_message = 'Success: Booking cancelled and logged in audit log.';

END proc_label //

DELIMITER ;


-- =============================================================================
-- SECTION 4: REAL-TIME AVAILABILITY & OCCUPANCY ANALYTICS QUERIES
-- =============================================================================

-- Query 4.1: Real-time Date/Time Slot Availability Finder
-- Input parameters: Target location_id, requested start & end times
SELECT 
    ps.parking_id,
    ps.space_number,
    ps.space_type,
    l.location_name,
    l.city,
    l.hourly_rate
FROM ParkingSpaces ps
JOIN Locations l ON ps.location_id = l.location_id
WHERE ps.location_id = 1                          -- Filter by Location ID
  AND ps.is_active = TRUE                         -- Only active slots
  AND ps.parking_id NOT IN (
      -- Exclude all slots with overlapping active bookings
      SELECT b.parking_id
      FROM Bookings b
      WHERE b.status IN ('Pending', 'Confirmed')
        AND b.start_time < '2026-09-01 15:00:00'  -- Requested End Time
        AND b.end_time   > '2026-09-01 10:00:00'  -- Requested Start Time
  )
ORDER BY ps.space_number ASC;


-- Query 4.2: Location-wise Real-Time Occupancy Summary
SELECT 
    l.location_id,
    l.location_name,
    l.city,
    COUNT(ps.parking_id) AS total_slots,
    COUNT(DISTINCT active_b.parking_id) AS currently_occupied_slots,
    (COUNT(ps.parking_id) - COUNT(DISTINCT active_b.parking_id)) AS currently_available_slots,
    ROUND(
        (COUNT(DISTINCT active_b.parking_id) * 100.0) / NULLIF(COUNT(ps.parking_id), 0),
        2
    ) AS current_occupancy_rate_pct
FROM Locations l
JOIN ParkingSpaces ps 
    ON l.location_id = ps.location_id 
   AND ps.is_active = TRUE
LEFT JOIN Bookings active_b 
    ON ps.parking_id = active_b.parking_id
   AND active_b.status = 'Confirmed'
   AND NOW() BETWEEN active_b.start_time AND active_b.end_time
GROUP BY l.location_id, l.location_name, l.city
ORDER BY current_occupancy_rate_pct DESC;


-- Query 4.3: Daily Bookings Trend
SELECT 
    DATE(b.start_time) AS booking_date,
    COUNT(b.booking_id) AS total_bookings,
    SUM(CASE WHEN b.status = 'Confirmed' THEN 1 ELSE 0 END) AS confirmed_bookings,
    SUM(CASE WHEN b.status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_bookings,
    SUM(CASE WHEN b.status = 'Completed' THEN 1 ELSE 0 END) AS completed_bookings
FROM Bookings b
GROUP BY DATE(b.start_time)
ORDER BY booking_date DESC;


-- Query 4.4: Revenue by Parking Location (Normalized JOINs)
SELECT 
    l.location_name,
    l.city,
    COUNT(DISTINCT b.booking_id) AS completed_bookings,
    SUM(p.amount) AS total_revenue
FROM Payments p
JOIN Bookings b ON p.booking_id = b.booking_id
JOIN ParkingSpaces ps ON b.parking_id = ps.parking_id
JOIN Locations l ON ps.location_id = l.location_id
WHERE p.payment_status = 'Successful'
GROUP BY l.location_id, l.location_name, l.city
ORDER BY total_revenue DESC;


-- Query 4.5: Top Users by Bookings (Excluding Cancelled)
SELECT 
    u.user_id,
    u.full_name,
    u.email,
    u.phone_number,
    COUNT(b.booking_id) AS total_valid_bookings,
    IFNULL(SUM(b.total_amount), 0.00) AS total_spend
FROM Users u
JOIN Bookings b ON u.user_id = b.user_id
WHERE b.status <> 'Cancelled'
GROUP BY u.user_id, u.full_name, u.email, u.phone_number
ORDER BY total_valid_bookings DESC;