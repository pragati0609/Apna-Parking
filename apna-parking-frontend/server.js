const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Calculate distance between two coordinates in kilometers (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // 1 decimal place
}

// Generate realistic slots for floors
function generateFloorSlots(floorName, count, rate, evCount = 4) {
  const slots = [];
  const types = ['car', 'car', 'car', 'bike', 'bike', 'ev', 'truck'];
  for (let i = 1; i <= count; i++) {
    const slotNumber = i < 10 ? `0${i}` : `${i}`;
    const isEV = i <= evCount;
    const type = isEV ? 'ev' : (i % 5 === 0 ? 'bike' : (i % 12 === 0 ? 'truck' : 'car'));
    // Random occupancy (approx 45% occupied)
    const isOccupied = (i * 7 + 3) % 3 === 0;
    
    slots.push({
      id: `${floorName}-${slotNumber}`,
      number: `${slotNumber}`,
      floor: floorName,
      type: type,
      isEV: isEV,
      isOccupied: isOccupied,
      rate: isEV ? rate + 20 : (type === 'bike' ? Math.round(rate * 0.4) : (type === 'truck' ? rate * 2 : rate)),
      reservedBy: isOccupied ? 'MH12 AB ' + (1000 + i * 13) : null
    });
  }
  return slots;
}

// Seed Database of Parking Locations
let parkingSpots = [
  {
    id: 'spot-1',
    name: 'City Center Parking',
    address: 'FC Road, Deccan Gymkhana, Pune, Maharashtra 411004',
    area: 'FC Road, Pune',
    city: 'Pune',
    lat: 18.5204,
    lng: 73.8415,
    hourlyRate: 40,
    dailyRate: 350,
    monthlyRate: 2499,
    rating: 4.5,
    reviewsCount: 120,
    totalSpots: 180,
    availableSpots: 42,
    status: 'Available',
    category: 'Commercial Mall & Plaza',
    image: '/assets/images/garage_preview.jpg',
    bannerImage: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80',
    description: 'Spacious and secure multi-level underground parking at the heart of FC Road. 24/7 access with high-definition CCTV surveillance, smart license plate recognition, and EV charging stations.',
    vehicleTypes: ['car', 'bike', 'ev', 'truck'],
    amenities: ['CCTV Surveillance', '24/7 Security Guard', 'Covered Basement', '24/7 Access', 'EV Fast Charging', 'Valet Parking', 'Car Wash on Request', 'Wheelchair Accessible'],
    operatingHours: '24 Hours Open',
    floors: [
      { floor: 'B1', name: 'Basement 1 (Express Access)', total: 60, available: 14, slots: generateFloorSlots('B1', 24, 40, 6) },
      { floor: 'B2', name: 'Basement 2 (Standard & Long Stay)', total: 60, available: 16, slots: generateFloorSlots('B2', 24, 40, 4) },
      { floor: 'B3', name: 'Basement 3 (Economy & Fleet)', total: 60, available: 12, slots: generateFloorSlots('B3', 24, 35, 2) }
    ]
  },
  {
    id: 'spot-2',
    name: 'Phoenix Marketcity Parking',
    address: 'Viman Nagar, Nagar Road, Pune, Maharashtra 411014',
    area: 'Viman Nagar, Pune',
    city: 'Pune',
    lat: 18.5621,
    lng: 73.9168,
    hourlyRate: 50,
    dailyRate: 450,
    monthlyRate: 2999,
    rating: 4.3,
    reviewsCount: 98,
    totalSpots: 450,
    availableSpots: 89,
    status: 'Available',
    category: 'Mega Shopping Mall',
    image: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80',
    description: 'Premium automated multi-tier parking with direct mall elevator access. Includes high-speed DC fast chargers for all EV types and dedicated bike bays.',
    vehicleTypes: ['car', 'bike', 'ev'],
    amenities: ['CCTV Surveillance', 'Covered Basement', 'EV Fast Charging', 'Direct Mall Access', 'Automated Boom Barrier', 'Security Patrol'],
    operatingHours: '09:00 AM - 12:00 AM',
    floors: [
      { floor: 'Level 1', name: 'Ground / Level 1 (Mall Entrance)', total: 80, available: 20, slots: generateFloorSlots('L1', 24, 50, 8) },
      { floor: 'Level 2', name: 'Level 2 (Cinema & Food Court)', total: 80, available: 35, slots: generateFloorSlots('L2', 24, 50, 4) },
      { floor: 'Level 3', name: 'Level 3 (Rooftop Open Bay)', total: 90, available: 34, slots: generateFloorSlots('L3', 24, 45, 2) }
    ]
  },
  {
    id: 'spot-3',
    name: 'West End Mall Parking',
    address: 'Near Parihar Chowk, Aundh, Pune, Maharashtra 411007',
    area: 'Aundh, Pune',
    city: 'Pune',
    lat: 18.5604,
    lng: 73.8077,
    hourlyRate: 30,
    dailyRate: 280,
    monthlyRate: 1999,
    rating: 4.6,
    reviewsCount: 110,
    totalSpots: 220,
    availableSpots: 64,
    status: 'Available',
    category: 'Commercial Hub',
    image: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=800&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=800&q=80',
    description: 'Affordable, secure underground parking near Parihar Chowk, Aundh. Perfect for office goers, shoppers, and dinner visitors.',
    vehicleTypes: ['car', 'bike', 'ev'],
    amenities: ['CCTV Surveillance', 'Covered Basement', '24/7 Access', 'Security Staff', 'Online Fast Checkout'],
    operatingHours: '24 Hours Open',
    floors: [
      { floor: 'B1', name: 'Basement 1 (Shoppers Bay)', total: 70, available: 28, slots: generateFloorSlots('B1', 24, 30, 4) },
      { floor: 'B2', name: 'Basement 2 (Extended Stay)', total: 80, available: 36, slots: generateFloorSlots('B2', 24, 30, 2) }
    ]
  },
  {
    id: 'spot-4',
    name: 'Koregaon Park Plaza Parking',
    address: 'North Main Road, Koregaon Park, Pune, Maharashtra 411001',
    area: 'Koregaon Park, Pune',
    city: 'Pune',
    lat: 18.5362,
    lng: 73.8940,
    hourlyRate: 45,
    dailyRate: 400,
    monthlyRate: 2800,
    rating: 4.7,
    reviewsCount: 145,
    totalSpots: 160,
    availableSpots: 19,
    status: 'Fast Filling',
    category: 'Premium Lifestyle District',
    image: 'https://images.unsplash.com/photo-1543465077-db45d34b88a5?auto=format&fit=crop&w=800&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1543465077-db45d34b88a5?auto=format&fit=crop&w=800&q=80',
    description: 'Prime parking facility situated right next to top cafes and fine dining restaurants in KP. Offers valet parking and 60kW EV DC fast charging.',
    vehicleTypes: ['car', 'bike', 'ev'],
    amenities: ['Valet Parking', 'EV Fast Charging', 'CCTV Surveillance', 'Covered', '24/7 Security'],
    operatingHours: '24 Hours Open',
    floors: [
      { floor: 'Ground', name: 'Ground Floor Valet Bay', total: 40, available: 5, slots: generateFloorSlots('G', 20, 50, 4) },
      { floor: 'B1', name: 'Basement 1 Covered', total: 60, available: 14, slots: generateFloorSlots('B1', 20, 45, 2) }
    ]
  },
  {
    id: 'spot-5',
    name: 'Shivaji Nagar Station Parking Complex',
    address: 'Near Metro Station & Railway Terminus, Shivaji Nagar, Pune 411005',
    area: 'Shivaji Nagar, Pune',
    city: 'Pune',
    lat: 18.5314,
    lng: 73.8553,
    hourlyRate: 25,
    dailyRate: 200,
    monthlyRate: 1500,
    rating: 4.2,
    reviewsCount: 230,
    totalSpots: 350,
    availableSpots: 76,
    status: 'Available',
    category: 'Transit & Metro Hub',
    image: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80',
    description: 'Direct transit connectivity to Metro Line 1 & Pune Suburban Trains. Ideal for daily train and metro commuters with safe overnight parking.',
    vehicleTypes: ['car', 'bike', 'truck'],
    amenities: ['24/7 Access', 'CCTV Surveillance', 'Covered Bike Shed', 'Security Guard', 'Fast Tag Entry'],
    operatingHours: '24 Hours Open',
    floors: [
      { floor: 'Ground', name: 'Ground Floor Multi-bay', total: 100, available: 25, slots: generateFloorSlots('G', 24, 25, 0) },
      { floor: 'P1', name: 'Podium 1 Car Bay', total: 120, available: 51, slots: generateFloorSlots('P1', 24, 25, 2) }
    ]
  },
  {
    id: 'spot-6',
    name: 'Hinjewadi Tech Park Smart Parking',
    address: 'Phase 1, Rajiv Gandhi Infotech Park, Hinjewadi, Pune 411057',
    area: 'Hinjewadi Phase 1, Pune',
    city: 'Pune',
    lat: 18.5912,
    lng: 73.7389,
    hourlyRate: 35,
    dailyRate: 300,
    monthlyRate: 2200,
    rating: 4.8,
    reviewsCount: 310,
    totalSpots: 600,
    availableSpots: 140,
    status: 'Available',
    category: 'IT Park Multi-Level',
    image: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80',
    description: 'State-of-the-art smart parking facility with 12 EV charging points, automated number plate recognition (ANPR), and reserved corporate bays.',
    vehicleTypes: ['car', 'bike', 'ev', 'truck'],
    amenities: ['12x EV Fast Chargers', 'ANPR Smart Gate', 'Covered Basement', '24/7 Access', 'Valet', 'Car Wash Station'],
    operatingHours: '24 Hours Open',
    floors: [
      { floor: 'B1', name: 'Basement 1 (VIP & EV Hub)', total: 100, available: 32, slots: generateFloorSlots('B1', 24, 35, 12) },
      { floor: 'B2', name: 'Basement 2 (Corporate Reserved)', total: 120, available: 48, slots: generateFloorSlots('B2', 24, 35, 4) },
      { floor: 'B3', name: 'Basement 3 (General Visitor)', total: 120, available: 60, slots: generateFloorSlots('B3', 24, 30, 2) }
    ]
  },
  {
    id: 'spot-7',
    name: 'Bandra Kurla Complex (BKC) Smart Hub',
    address: 'G Block, Bandra Kurla Complex, Bandra East, Mumbai 400051',
    area: 'BKC, Mumbai',
    city: 'Mumbai',
    lat: 19.0657,
    lng: 72.8684,
    hourlyRate: 70,
    dailyRate: 600,
    monthlyRate: 4500,
    rating: 4.9,
    reviewsCount: 420,
    totalSpots: 500,
    availableSpots: 38,
    status: 'Fast Filling',
    category: 'Financial District Plaza',
    image: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=800&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=800&q=80',
    description: 'Ultra-modern multi-level car parking in Mumbai’s premier business district. Features 100% covered bays, 150kW ultra-fast EV chargers, and biometric access.',
    vehicleTypes: ['car', 'bike', 'ev'],
    amenities: ['150kW EV Ultra Chargers', 'Covered Multi-level', '24/7 Security', 'Valet Concierge', 'Executive Lounge'],
    operatingHours: '24 Hours Open',
    floors: [
      { floor: 'B1', name: 'Executive Level 1', total: 80, available: 10, slots: generateFloorSlots('B1', 24, 70, 8) },
      { floor: 'B2', name: 'Business Level 2', total: 90, available: 15, slots: generateFloorSlots('B2', 24, 70, 6) },
      { floor: 'B3', name: 'Standard Level 3', total: 100, available: 13, slots: generateFloorSlots('B3', 24, 60, 4) }
    ]
  },
  {
    id: 'spot-8',
    name: 'Indiranagar Metro & Club Parking',
    address: '100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038',
    area: 'Indiranagar, Bengaluru',
    city: 'Bengaluru',
    lat: 12.9784,
    lng: 77.6408,
    hourlyRate: 50,
    dailyRate: 400,
    monthlyRate: 3200,
    rating: 4.7,
    reviewsCount: 185,
    totalSpots: 200,
    availableSpots: 52,
    status: 'Available',
    category: 'Commercial & Nightlife District',
    image: 'https://images.unsplash.com/photo-1543465077-db45d34b88a5?auto=format&fit=crop&w=800&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1543465077-db45d34b88a5?auto=format&fit=crop&w=800&q=80',
    description: 'Centralized parking right on 100 Feet Road. Easy walking distance to Bangalore’s finest restaurants, boutiques, and Indiranagar Metro Station.',
    vehicleTypes: ['car', 'bike', 'ev'],
    amenities: ['Covered', 'CCTV', 'EV Charging', '24/7 Security Guard', 'Contactless QR Exit'],
    operatingHours: '24 Hours Open',
    floors: [
      { floor: 'B1', name: 'Basement 1', total: 60, available: 22, slots: generateFloorSlots('B1', 24, 50, 6) },
      { floor: 'B2', name: 'Basement 2', total: 60, available: 30, slots: generateFloorSlots('B2', 24, 50, 4) }
    ]
  }
];

// Seed Bookings database
let userBookings = [
  {
    id: 'AP-2026-8821',
    spotId: 'spot-1',
    parkingName: 'City Center Parking',
    parkingAddress: 'FC Road, Deccan Gymkhana, Pune',
    slotNumber: 'B2-08',
    floor: 'B2',
    vehicleType: 'car',
    vehiclePlate: 'MH 12 AB 4589',
    vehicleModel: 'Honda City (White)',
    date: '2026-08-31',
    startTime: '16:00',
    endTime: '19:00',
    durationHours: 3,
    hourlyRate: 40,
    totalAmount: 120,
    taxAmount: 21.6,
    finalAmount: 141.6,
    status: 'Active',
    paymentMethod: 'UPI / Online FastPay',
    qrCodeData: 'APNA-PARKING-PASS-AP-2026-8821-B2-08',
    createdAt: new Date().toISOString()
  },
  {
    id: 'AP-2026-7910',
    spotId: 'spot-2',
    parkingName: 'Phoenix Marketcity Parking',
    parkingAddress: 'Viman Nagar, Nagar Road, Pune',
    slotNumber: 'L1-14',
    floor: 'Level 1',
    vehicleType: 'car',
    vehiclePlate: 'MH 12 AB 4589',
    vehicleModel: 'Honda City (White)',
    date: '2026-08-28',
    startTime: '14:00',
    endTime: '18:00',
    durationHours: 4,
    hourlyRate: 50,
    totalAmount: 200,
    taxAmount: 36.0,
    finalAmount: 236.0,
    status: 'Completed',
    paymentMethod: 'Credit Card',
    qrCodeData: 'APNA-PARKING-PASS-AP-2026-7910-L1-14',
    createdAt: '2026-08-28T14:00:00Z'
  }
];

// Contact inquiries / Partner submissions
let partnerSubmissions = [];

// =================== REST API ROUTES ===================

// GET /api/parking-spots - Retrieve all parking spots with optional query filters
app.get('/api/parking-spots', (req, res) => {
  const { search, city, vehicleType, maxPrice, status, sort } = req.query;
  let results = [...parkingSpots];

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.area.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q)
    );
  }

  if (city) {
    results = results.filter((s) => s.city.toLowerCase() === city.toLowerCase());
  }

  if (vehicleType && vehicleType !== 'all') {
    results = results.filter((s) => s.vehicleTypes.includes(vehicleType));
  }

  if (maxPrice) {
    const priceLimit = parseFloat(maxPrice);
    if (!isNaN(priceLimit)) {
      results = results.filter((s) => s.hourlyRate <= priceLimit);
    }
  }

  if (status && status !== 'all') {
    results = results.filter((s) => s.status.toLowerCase() === status.toLowerCase());
  }

  // Sort
  if (sort === 'price-low') {
    results.sort((a, b) => a.hourlyRate - b.hourlyRate);
  } else if (sort === 'rating') {
    results.sort((a, b) => b.rating - a.rating);
  } else if (sort === 'availability') {
    results.sort((a, b) => b.availableSpots - a.availableSpots);
  }

  res.json({
    success: true,
    count: results.length,
    data: results
  });
});

// GET /api/parking-spots/nearby - Calculate live distance from user GPS coordinates
app.get('/api/parking-spots/nearby', (req, res) => {
  const userLat = parseFloat(req.query.lat);
  const userLng = parseFloat(req.query.lng);
  const radius = parseFloat(req.query.radius) || 25; // default 25km radius
  const vehicleType = req.query.vehicleType;

  // Fallback to Pune center if no valid coordinates provided
  const lat = !isNaN(userLat) ? userLat : 18.5204;
  const lng = !isNaN(userLng) ? userLng : 73.8567;

  let spotsWithDistance = parkingSpots.map((spot) => {
    const dist = calculateDistance(lat, lng, spot.lat, spot.lng);
    // Estimated drive time (approx 25 km/h in city traffic + 2 min buffer)
    const travelTimeMinutes = Math.max(2, Math.round((dist / 25) * 60));
    return {
      ...spot,
      distanceKm: dist,
      travelTimeMinutes: travelTimeMinutes
    };
  });

  if (vehicleType && vehicleType !== 'all') {
    spotsWithDistance = spotsWithDistance.filter((s) => s.vehicleTypes.includes(vehicleType));
  }

  // Sort by closest distance
  spotsWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

  res.json({
    success: true,
    userLocation: { lat, lng, isDefault: isNaN(userLat) || isNaN(userLng) },
    count: spotsWithDistance.length,
    data: spotsWithDistance
  });
});

// GET /api/parking-spots/:id - Detailed parking spot info
app.get('/api/parking-spots/:id', (req, res) => {
  const spot = parkingSpots.find((s) => s.id === req.params.id);
  if (!spot) {
    return res.status(404).json({ success: false, message: 'Parking spot not found' });
  }
  res.json({ success: true, data: spot });
});

// POST /api/bookings - Create a new parking spot booking
app.post('/api/bookings', (req, res) => {
  const {
    spotId,
    floor,
    slotNumber,
    vehicleType,
    vehiclePlate,
    vehicleModel,
    date,
    startTime,
    durationHours,
    customerName,
    customerPhone,
    customerEmail,
    paymentMethod
  } = req.body;

  if (!spotId || !slotNumber || !date || !startTime || !durationHours || !vehiclePlate) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required booking fields (spotId, slotNumber, date, startTime, durationHours, vehiclePlate)'
    });
  }

  const spot = parkingSpots.find((s) => s.id === spotId);
  if (!spot) {
    return res.status(404).json({ success: false, message: 'Invalid parking spot selected' });
  }

  const hours = parseInt(durationHours, 10) || 1;
  const rate = spot.hourlyRate;
  const subtotal = rate * hours;
  const tax = Math.round(subtotal * 0.18 * 10) / 10;
  const total = Math.round((subtotal + tax) * 10) / 10;

  // Calculate end time
  const [startH, startM] = startTime.split(':').map(Number);
  const endH = (startH + hours) % 24;
  const endTime = `${endH < 10 ? '0' + endH : endH}:${startM < 10 ? '0' + startM : startM}`;

  const bookingId = `AP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newBooking = {
    id: bookingId,
    spotId: spot.id,
    parkingName: spot.name,
    parkingAddress: spot.address,
    slotNumber: slotNumber,
    floor: floor || 'B1',
    vehicleType: vehicleType || 'car',
    vehiclePlate: vehiclePlate.toUpperCase(),
    vehicleModel: vehicleModel || 'Standard Vehicle',
    customerName: customerName || 'Valued Driver',
    customerPhone: customerPhone || '+91 98765 43210',
    customerEmail: customerEmail || 'driver@example.com',
    date: date,
    startTime: startTime,
    endTime: endTime,
    durationHours: hours,
    hourlyRate: rate,
    totalAmount: subtotal,
    taxAmount: tax,
    finalAmount: total,
    status: 'Active',
    paymentMethod: paymentMethod || 'Instant UPI FastPay',
    qrCodeData: `APNA-PARKING-PASS|${bookingId}|${spot.name}|${slotNumber}|${vehiclePlate}|${date}|${startTime}`,
    createdAt: new Date().toISOString()
  };

  // Prepend to bookings
  userBookings.unshift(newBooking);

  // Update spot occupancy
  spot.availableSpots = Math.max(0, spot.availableSpots - 1);
  if (spot.floors) {
    spot.floors.forEach((fl) => {
      if (fl.floor === floor || fl.name.includes(floor)) {
        fl.available = Math.max(0, fl.available - 1);
        const sl = fl.slots.find((s) => s.id === slotNumber || s.number === slotNumber);
        if (sl) {
          sl.isOccupied = true;
          sl.reservedBy = vehiclePlate;
        }
      }
    });
  }

  res.status(201).json({
    success: true,
    message: 'Slot booked successfully! Your digital QR pass is ready.',
    data: newBooking
  });
});

// GET /api/bookings - Get all user bookings
app.get('/api/bookings', (req, res) => {
  res.json({
    success: true,
    count: userBookings.length,
    data: userBookings
  });
});

// GET /api/bookings/:id - Get single booking details
app.get('/api/bookings/:id', (req, res) => {
  const booking = userBookings.find((b) => b.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }
  res.json({ success: true, data: booking });
});

// POST /api/bookings/:id/cancel - Cancel a booking
app.post('/api/bookings/:id/cancel', (req, res) => {
  const booking = userBookings.find((b) => b.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }
  booking.status = 'Cancelled';
  res.json({ success: true, message: 'Booking has been cancelled.', data: booking });
});

// POST /api/bookings/:id/extend - Extend booking duration
app.post('/api/bookings/:id/extend', (req, res) => {
  const booking = userBookings.find((b) => b.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }
  const extraHours = parseInt(req.body.extraHours, 10) || 1;
  booking.durationHours += extraHours;
  const [endH, endM] = booking.endTime.split(':').map(Number);
  const newEndH = (endH + extraHours) % 24;
  booking.endTime = `${newEndH < 10 ? '0' + newEndH : newEndH}:${endM < 10 ? '0' + endM : endM}`;
  booking.finalAmount += booking.hourlyRate * extraHours;

  res.json({
    success: true,
    message: `Booking extended by ${extraHours} hour(s). New end time is ${booking.endTime}`,
    data: booking
  });
});

// POST /api/contact - Space Host & General Inquiries ("Talk to us")
app.post('/api/contact', (req, res) => {
  const { name, email, phone, inquiryType, message, spaceAddress, totalSpotsAvailable } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Name and email are required.' });
  }

  const submission = {
    id: `INQ-${Date.now()}`,
    name,
    email,
    phone: phone || 'N/A',
    inquiryType: inquiryType || 'General Inquiry',
    message: message || '',
    spaceAddress: spaceAddress || '',
    totalSpotsAvailable: totalSpotsAvailable || 0,
    timestamp: new Date().toISOString()
  };

  partnerSubmissions.push(submission);
  res.json({
    success: true,
    message: 'Thank you for reaching out! Our team will contact you within 15 minutes.',
    data: submission
  });
});

// GET /api/stats - Live Parking Platform Statistics
app.get('/api/stats', (req, res) => {
  const totalSlots = parkingSpots.reduce((acc, curr) => acc + curr.totalSpots, 0);
  const totalAvailable = parkingSpots.reduce((acc, curr) => acc + curr.availableSpots, 0);
  res.json({
    success: true,
    data: {
      totalSlotsNetwork: 54200,
      activeCities: 28,
      liveAvailableSlots: totalAvailable,
      todayBookingsCount: 14890,
      averageSearchTimeSavedMinutes: 22,
      carbonReductionKg: 8420
    }
  });
});

// Fallback route to serve index.html for SPA-like navigation
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  const filePath = path.join(__dirname, 'public', req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚗 Apna Parking Full-Stack Server Running on http://localhost:${PORT}`);
  console.log(`📍 Live Map & Geolocation API Ready`);
  console.log(`🅿️ Multi-Floor Interactive Slot Booking Active`);
  console.log(`====================================================`);
});
