# Apna Parking - Complete Manual Testing & Founder Demo Playbook
**A Step-by-Step Practical Guide: From UI Interaction to Database Verification & Execution**

---

## Executive Summary & System Architecture

### The Full-Stack Architecture
```
┌────────────────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER (PORT 3000)                       │
│  Node.js / Express Server • HTML5 / CSS3 • Vanilla ES6+ Modules        │
│  Leaflet.js GPS Mapping • Multi-Floor Visual Radar • Razorpay Checkout │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST APIs (CORS Enabled)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  APPLICATION API GATEWAY (PORT 5000)                   │
│  Python Flask REST API • Flask-JWT-Extended (Stateless Auth)           │
│  SQLAlchemy ORM • Flask-Limiter (DDoS Shield) • Razorpay Python SDK    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQL Connection Pooling
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER (PORT 3306)                          │
│  MySQL Database: `ApnaParking`                                         │
│  Relational Tables: Users, Locations, ParkingSpaces, Bookings,         │
│                     Payments, Vehicles, Inquiries                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Pre-Flight Check: Running the System

Ensure both servers and MySQL are running before starting your demo:

### 1. Database Check (MySQL)
Ensure your MySQL service is running on `localhost:3306`.
```powershell
# Open MySQL Command Line or Workbench with your credentials:
mysql -u root -p
# Enter password: pragatisql123
USE ApnaParking;
```

### 2. Backend Server (Flask - Port 5000)
Open a terminal in `apna-parking-backend`:
```powershell
cd "c:\Users\Pragati Trivedi\OneDrive\Desktop\Internship\Apna_Parking\apna-parking-backend"
.venv\Scripts\python.exe app.py
```
*Expected log output:*
```
 * Serving Flask app 'app'
 * Running on http://127.0.0.1:5000
```

### 3. Frontend Server (Node Express - Port 3000)
Open a second terminal in `apna-parking-frontend`:
```powershell
cd "c:\Users\Pragati Trivedi\OneDrive\Desktop\Internship\Apna_Parking\apna-parking-frontend"
node server.js
```
*Expected log output:*
```
====================================================
🚗 Apna Parking Full-Stack Server Running on http://localhost:3000
📍 Live Map Radar & Geolocation API Ready
🅿️ Multi-Floor Interactive Slot Booking Active
====================================================
```

---

## 10-Step Manual Testing & Founder Demonstration Journey

Follow this sequence step-by-step. For each step, perform the UI action, verify the database, and use the provided talking points to pitch the feature to your founder.

---

### STEP 1: Landing Page & Real-Time Platform Analytics

#### 1.1 Action in Browser
1. Open Google Chrome or any browser.
2. Navigate to: `http://localhost:3000/`
3. Notice the hero banner, vehicle selector chips, and live platform statistics section.

#### 1.2 Under the Hood (Technical Mechanics)
- On load, the client executes `ApnaAPI.getPlatformStats()` calling `GET http://localhost:5000/api/stats`.
- The Flask backend aggregates metrics and returns JSON:
  ```json
  {
    "success": true,
    "data": {
      "totalSlotsNetwork": 54200,
      "liveAvailableSlots": 420,
      "activeCities": 28,
      "averageSearchTimeSavedMinutes": 22
    }
  }
  ```

### STEP 2: Live GPS Radar & Proximity Search

#### 2.1 Action in Browser
1. Click **"Live Radar"** in the navigation bar (or visit `http://localhost:3000/find-parking.html`).
2. Notice the interactive Leaflet map centered on Pune (`18.5204° N, 73.8415° E`).
3. Click the vehicle chips: switch from **"All Vehicles"** to **"Car"** or **"Two-Wheeler"**.
4. Type in the search box: `Phoenix` or `Deccan`. Notice the cards filter in real-time.
5. Click **"📍 Detect My Live Location"** or inspect the sorted list showing distances (e.g. `0.0 km`, `0.6 km`, `1.9 km`) and estimated drive times.

#### 2.2 Under the Hood
- The map controller triggers `GET http://localhost:5000/api/parking-spots/nearby?lat=18.5204&lng=73.8415&radius=30`.
- The Flask backend uses the mathematical **Haversine formula** to calculate great-circle distances between the driver's GPS coordinate and all facilities in MySQL, sorting by proximity.

#### 2.3 Database Verification (MySQL Query)
```sql
SELECT location_id, location_name, address, hourly_rate, rating, latitude, longitude 
FROM Locations 
ORDER BY location_id ASC;
```
*Expected Result:* You will see 6 seeded facilities in Pune (City Center, Deccan Gymkhana, Shivaji Nagar, Koregaon Park, Phoenix Marketcity, Amanora Mall).

---

### STEP 3: User Signup & Database Integrity

#### 3.1 Action in Browser
1. In the top navigation bar, click the **"🔑 Sign In"** button (or click any action requiring login).
2. The modal pops up. Click the **"Sign Up"** tab.
3. Fill in unique credentials:
   - **Full Name**: `Ananya Verma`
   - **Email Address**: `ananya.verma@example.com`
   - **Phone Number**: `9822012345`
   - **Create Password**: `SecurePass@2026`
4. Click **"Create Account ➔"**.
5. You will see a green toast: *"Account created successfully! Welcome to Apna Parking."*

#### 3.2 Under the Hood
- The client calls `ApnaAPI.signup()` -> `POST http://localhost:5000/signup`.
- The backend validates the email syntax via `email-validator`.
- It hashes the password using standard PBKDF2/scrypt (`werkzeug.security.generate_password_hash`).
- It verifies that the email and phone number are unique.
- The client automatically transitions to log the user in.

#### 3.3 Database Verification (MySQL Query)
Run this query in MySQL:
```sql
SELECT user_id, full_name, email, phone_number, password_hash, created_at 
FROM Users 
ORDER BY user_id DESC 
LIMIT 1;
```
*Expected Result:*
- `full_name`: `Ananya Verma`
- `email`: `ananya.verma@example.com`
- `phone_number`: `9822012345`
- `password_hash`: A long encrypted string starting with `scrypt:32768:8:1$...` or `pbkdf2:sha256$...` (confirming **no raw passwords** are stored).
---

### STEP 4: User Login & JWT Session Management

#### 4.1 Action in Browser
1. If not auto-logged in, click **"🔑 Sign In"** -> **"Log In"** tab.
2. Enter:
   - Email: `ananya.verma@example.com`
   - Password: `SecurePass@2026`
3. Click **"Log In ➔"**.
4. Notice:
   - The top header now displays driver's avatar and name: **"👤 Ananya"**.
   - A **"🚪 Logout"** button appears.
   - The drawer menu now synchronizes with the authenticated driver state.

#### 4.2 Inspecting JWT in Browser DevTools
1. Press `F12` on your keyboard (Open Developer Tools).
2. Click the **"Application"** tab (in Chrome/Edge).
3. Under the left sidebar, expand **"Local Storage"** -> click `http://localhost:3000`.
4. Inspect the keys:
   - `apna_auth_token`: A signed JSON Web Token (e.g. `eyJhbGciOiJIUzI1NiIsInR5cCI...`).
   - `apna_user`: JSON object with user details: `{"id": 18, "name": "Ananya Verma", "email": "..."}`.

#### 4.3 Under the Hood
- The client sends `POST http://localhost:5000/login`.
- Flask verifies the hash via `check_password_hash`.
- On success, it issues a cryptographically signed JWT with the user's ID as identity.
- Client stores it in `localStorage` and automatically attaches `Authorization: Bearer <token>` to all subsequent requests.

---

### STEP 5: Interactive Multi-Floor Slot Selection & Booking

#### 5.1 Action in Browser
1. Click **"Book a Slot"** in the navigation bar (or navigate to `http://localhost:3000/book-slot.html?spotId=spot-1`).
2. Notice the Facility Header: **City Center Parking** (or Downtown Central Garage), Hourly Rate: `₹60/hr`.
3. Click the Floor Tabs: **"🏢 Basement 1"** or **"🏢 Basement 2"**.
4. In the visual slot grid:
   - Green boxes are available slots.
   - Slots with `⚡ EV` indicate EV charging stations.
5. Click on an available slot, for example **`A-102`** (or `B-105`).
6. Notice the **Summary Card** immediately updates:
   - Selected Slot: `A-102`
   - Hourly Rate: `₹60/hr`
   - Duration: `2 Hour(s)` (adjust with the stepper to test dynamic recalculation)
   - Subtotal: `₹120`
   - Taxes (18% GST): `₹21.6`
   - **Total Fare: `₹141.6`**
7. Check the Booking Form:
   - Driver Name and Phone are auto-filled from your profile.
   - Vehicle Registration Number: Enter your plate (e.g. `MH12AB9999`).
8. Click **"Pay & Confirm Booking"**.

#### 5.2 Under the Hood
- The client calls `POST http://localhost:5000/bookings` with:
  ```json
  {
    "spotId": "spot-1",
    "floor": "B1",
    "slotNumber": "A-102",
    "vehiclePlate": "MH12AB9999",
    "vehicleType": "car",
    "date": "2026-10-15",
    "startTime": "14:00",
    "durationHours": 2
  }
  ```
- The backend checks for overlap conflict: if another user booked slot `A-102` for that window, it responds with `409 Conflict`.
- It registers or assigns the vehicle to `Ananya Verma` in the `Vehicles` table.
- It inserts a new record into `Bookings` with status `Pending` (awaiting payment).

#### 5.3 Database Verification (MySQL Query)
```sql
SELECT booking_id, user_id, parking_id, vehicle_id, start_time, end_time, total_amount, status, created_at 
FROM Bookings 
ORDER BY booking_id DESC 
LIMIT 1;

SELECT vehicle_id, user_id, license_plate, vehicle_type 
FROM Vehicles 
WHERE user_id = (SELECT user_id FROM Users WHERE email = 'ananya.verma@example.com');
```
*Expected Result:*
- A new booking with `status = 'Pending'` or `'Active'`.
- Vehicle plate cleaned and normalized to `MH12AB9999` matching Indian motor vehicle standards.
---

### STEP 6: Razorpay Payment Gateway & Server Verification

#### 6.1 Action in Browser
1. Immediately upon clicking confirm, the official **Razorpay Checkout** popup appears over the screen:
   - Header: **Apna Parking**
   - Item: `Slot A-102 - City Center Parking`
   - Amount: `₹141.60` (or `₹120.00`)
   - Pre-filled Driver Name, Email, and Phone number.
2. Select your payment method in the Razorpay popup:
   - **Method A (UPI)**: Click **UPI / QR** -> Click any test UPI ID (e.g. `success@razorpay`) -> Click **"Pay Now"**.
   - **Method B (Netbanking)**: Click **Netbanking** -> Choose **State Bank of India** or **HDFC** -> In the mock bank screen, click the green **"Success"** button.
   - **Method C (Test Card)**:
     - Card Number: `4111 1111 1111 1111`
     - Expiry: Any future date (e.g. `12/28`)
     - CVV: `123`
     - OTP: `123456` -> Click Submit.
3. Razorpay completes the transaction and passes `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` back to our frontend.
4. The screen shows a toast: *"🎉 Payment Verified! Slot Confirmed."*

#### 6.2 Under the Hood
1. Before opening Checkout, backend generates order via Razorpay API (`POST /payments/create`):
   - Creates Razorpay order `order_xxxxxx` with currency `INR` and amount in subunits (paise).
   - Generates a record in `Payments` table with status `Pending`.
2. On payment completion, Razorpay client SDK invokes the `handler` callback.
3. Client immediately calls `POST http://localhost:5000/payments/verify` with:
   - `razorpay_order_id`
   - `razorpay_payment_id`
   - `razorpay_signature`
4. The Flask backend computes an **HMAC SHA256** checksum using the secret `RAZORPAY_KEY_SECRET`:
   ```python
   client.utility.verify_payment_signature({
       'razorpay_order_id': order_id,
       'razorpay_payment_id': payment_id,
       'razorpay_signature': signature
   })
   ```
5. Only upon cryptographic signature match does the backend update the payment to `Successful` and the booking to `Confirmed`.

#### 6.3 Database Verification (MySQL Query)
```sql
SELECT payment_id, booking_id, amount, payment_status, payment_method, razorpay_order_id, razorpay_payment_id, paid_at 
FROM Payments 
ORDER BY payment_id DESC 
LIMIT 1;

SELECT booking_id, status, total_amount 
FROM Bookings 
ORDER BY booking_id DESC 
LIMIT 1;
```
*Expected Result:*
- `Payments.payment_status` is **`Successful`**.
- `Payments.razorpay_order_id` matches the live Razorpay Order ID.
- `Payments.razorpay_payment_id` contains the payment ID from Razorpay.
- `Bookings.status` is **`Confirmed`** (or `Active`).


### STEP 7: Digital QR Pass & Paperless Entry Ticket

#### 7.1 Action in Browser
1. Immediately upon payment verification, the **Digital Pass Modal** opens automatically with a celebratory animation.
2. The modal displays:
   - Green Confirmed Badge: `● Confirmed & Active`
   - Booking Reference: `AP-2026-0010`
   - Facility Name & Address: `City Center Parking, 100 Main St`
   - Slot Number: `A-102 (Basement 1)`
   - Vehicle Plate: `MH12AB9999`
   - Active Session Timings
   - **Dynamic High-Resolution QR Code**: Contains encrypted booking validation data.
3. You can test clicking **"Print / Save Pass"** (triggers the browser print view).
4. Click **"View in My Passes ➔"** to navigate to session management.

#### 7.2 Under the Hood
- The QR code data is generated server-side:
  `APNA-PARKING-PASS|AP-2026-0010|City Center Parking|A-102|MH12AB9999|2026-10-15|14:00`
- The client uses `qrcode.js` or SVG rendering to render the matrix code instantly without third-party external dependencies.

### STEP 8: My Passes, Time Extension & Cancellation

#### 8.1 Action in Browser
1. Click **"My Passes"** in the navigation bar (or navigate to `http://localhost:3000/my-bookings.html`).
2. You see your active booking card with a live session indicator: `⏳ Session active until 16:00 today`.
3. **Test Extension**:
   - Click the pink button: **"+ Extend (+1 hr)"**.
   - A confirmation dialog appears: *"Extend parking by 1 additional hour?"* Click OK.
   - You will see a success toast: *"Booking extended by 1 hour successfully."*
   - Notice the duration immediately changes from `2 Hours` to `3 Hours` (and end time increments by 1 hour).
4. **Test Pass Viewing**:
   - Click **"📱 View QR Pass"**. The digital pass modal re-appears with full ticket details.
5. **Test Cancellation**:
   - Click the **"Cancel"** link on the card.
   - Confirm the cancellation alert.
   - The card automatically moves from "Active Passes" down to "Past Booking History" with status `Cancelled`.

#### 8.2 Under the Hood
- Extension calls `POST http://localhost:5000/bookings/<id>/extend` with `{ "extraHours": 1 }`.
- Cancellation calls `POST http://localhost:5000/bookings/<id>/cancel`.
- Backend recalculates end times, updates the booking status, and flushes to MySQL.

#### 8.3 Database Verification (MySQL Query)
```sql
SELECT booking_id, user_id, start_time, end_time, total_amount, status 
FROM Bookings 
WHERE user_id = (SELECT user_id FROM Users WHERE email = 'ananya.verma@example.com')
ORDER BY booking_id DESC;
```
*Expected Result:*
- The booking status reflects `Cancelled`.
- `end_time` reflects the extended window prior to cancellation.

---

### STEP 9: Commercial Space Partner Inquiry (B2B Lead Funnel)

#### 9.1 Action in Browser
1. Click **"Partner with us"** in the navigation bar (or navigate to `http://localhost:3000/talk-to-us.html`).
2. Fill out the partnership host form:
   - **Your Name**: `Vikram Malhotra`
   - **Email Address**: `vikram@phoenixmall.com`
   - **Phone Number**: `9823098765`
   - **Property Location**: `Viman Nagar, Pune`
   - **Estimated Parking Spaces**: `150`
   - **Message**: `We manage a commercial plaza with 150 basement spaces and want to list on Apna Parking.`
3. Click **"Submit Space Details ➔"**.
4. You will see a confirmation alert: *"Thank you! Our facility partnership team will contact you within 24 hours."*

#### 9.2 Under the Hood
- Client executes `POST http://localhost:5000/api/contact`.
- Backend logs the B2B enterprise lead and prepares automated CRM dispatch.


### STEP 10: Secure User Logout & JWT Invalidation

#### 10.1 Action in Browser
1. In the top navigation bar, click the **"🚪 Logout"** button.
2. The UI smoothly transitions:
   - Header resets to show **"🔑 Sign In"** and **"🅿️ Book a Slot"**.
   - If on `my-bookings.html`, the passes container transitions to the friendly unauthenticated state: *"🔑 Sign In to View Your Passes"*.
3. Press `F12` -> `Application` -> `Local Storage`: `apna_auth_token` and `apna_user` are completely removed.

#### 10.2 Under the Hood
- The client calls `POST http://localhost:5000/logout` with Bearer auth.
- Backend Flask-JWT blocklists the JWT jti token identifier so it cannot be reused.
- Local client storage is scrubbed clean, preventing unauthorized session persistence on shared devices.


## Quick SQL Cheat-Sheet for Live Demo

Keep these SQL commands handy in MySQL Workbench or terminal to show live data during your demo:

```sql
-- 1. View latest registered users
SELECT user_id, full_name, email, phone_number, created_at FROM Users ORDER BY user_id DESC LIMIT 5;

-- 2. View all parking facilities and base rates
SELECT location_id, location_name, address, hourly_rate, rating FROM Locations;

-- 3. View latest bookings with status and user details
SELECT b.booking_id, u.full_name, b.parking_id, b.start_time, b.end_time, b.total_amount, b.status 
FROM Bookings b 
JOIN Users u ON b.user_id = u.user_id 
ORDER BY b.booking_id DESC LIMIT 5;

-- 4. View latest verified payments and Razorpay transaction IDs
SELECT payment_id, booking_id, amount, payment_status, payment_method, razorpay_order_id, razorpay_payment_id, paid_at 
FROM Payments 
ORDER BY payment_id DESC LIMIT 5;

-- 5. View registered customer vehicles
SELECT vehicle_id, user_id, license_plate, vehicle_type, make_model FROM Vehicles ORDER BY vehicle_id DESC LIMIT 5;
```

---