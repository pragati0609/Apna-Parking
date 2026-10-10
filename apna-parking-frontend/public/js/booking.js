/**
 * APNA PARKING - INTERACTIVE SLOT BOOKING CONTROLLER
 * Multi-Floor Spot Picker, Fare Calculator, and Digital QR Ticket Generator
 */

class BookingController {
  constructor() {
    this.selectedSpot = null;
    this.selectedFloor = 'B1';
    this.selectedSlotNumber = null;
    this.selectedSlotRate = 40;
    this.selectedVehicleType = 'car';
    this.durationHours = 2;
    this.currentSpotId = 'spot-1';

    this.init();
  }

  async init() {
    // Parse URL params if spotId is specified
    const urlParams = new URLSearchParams(window.location.search);
    const spotIdParam = urlParams.get('spotId');
    if (spotIdParam) {
      this.currentSpotId = spotIdParam;
    }

    // Set today's date in date picker
    const dateInput = document.getElementById('booking-date-input');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
      dateInput.min = today;
    }

    // Set current time rounded to next hour
    const timeInput = document.getElementById('booking-time-input');
    if (timeInput) {
      const now = new Date();
      now.setHours(now.getHours() + 1, 0, 0, 0);
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      timeInput.value = `${hours}:${minutes}`;
    }

    // Auto-fill driver details if logged in
    const user = window.ApnaAPI.getUser();
    if (user) {
      const phoneInput = document.getElementById('driver-phone-input');
      if (phoneInput && user.phone_number && !phoneInput.value) {
        phoneInput.value = user.phone_number;
      }
    }

    // Load Parking Spot Data
    await this.loadSpotData();

    // Event Listeners
    this.setupEventListeners();
  }

  async loadSpotData() {
    const res = await window.ApnaAPI.getSpotById(this.currentSpotId);
    if (res && res.success && res.data) {
      this.selectedSpot = res.data;
      this.renderSpotHeader();
      this.renderFloorTabs();
      this.renderFloorGrid();
      this.calculateFare();
    }
  }

  renderSpotHeader() {
    const titleEl = document.getElementById('booking-spot-name');
    const addrEl = document.getElementById('booking-spot-address');
    const rateEl = document.getElementById('booking-base-rate');

    if (titleEl) titleEl.innerText = this.selectedSpot.name;
    if (addrEl) addrEl.innerText = `📍 ${this.selectedSpot.address}`;
    if (rateEl) rateEl.innerText = `₹${this.selectedSpot.hourlyRate}/hr`;
  }

  renderFloorTabs() {
    const tabsContainer = document.getElementById('floor-tabs-container');
    if (!tabsContainer || !this.selectedSpot.floors) return;

    tabsContainer.innerHTML = this.selectedSpot.floors
      .map(
        (fl) => `
        <button type="button" class="floor-tab-btn ${fl.floor === this.selectedFloor ? 'active' : ''}" 
          onclick="window.bookingController.switchFloor('${fl.floor}')">
          🏢 ${fl.name} (${fl.available} Free)
        </button>
      `
      )
      .join('');
  }

  switchFloor(floorCode) {
    this.selectedFloor = floorCode;
    this.selectedSlotNumber = null;
    this.renderFloorTabs();
    this.renderFloorGrid();
    this.calculateFare();
  }

  renderFloorGrid() {
    const gridContainer = document.getElementById('parking-slots-grid');
    if (!gridContainer || !this.selectedSpot.floors) return;

    const floorData = this.selectedSpot.floors.find((fl) => fl.floor === this.selectedFloor);
    if (!floorData || !floorData.slots) return;

    gridContainer.innerHTML = floorData.slots
      .map((slot) => {
        const isSelected = this.selectedSlotNumber === slot.id;
        let icon = '🚗';
        if (slot.type === 'bike') icon = '🏍️';
        if (slot.type === 'truck') icon = '🚛';
        if (slot.isEV) icon = '⚡🚗';

        return `
        <div class="parking-slot-box ${slot.isOccupied ? 'occupied' : ''} ${slot.isEV ? 'ev-slot' : ''} ${isSelected ? 'selected' : ''}"
          data-slot-id="${slot.id}"
          data-rate="${slot.rate}"
          data-occupied="${slot.isOccupied}"
          onclick="window.bookingController.selectSlot('${slot.id}', ${slot.rate}, ${slot.isOccupied})">
          ${slot.isEV ? '<span class="slot-ev-badge">⚡ EV</span>' : ''}
          <div class="slot-icon-graphic">${icon}</div>
          <div class="slot-num">${slot.id}</div>
          <div class="slot-price-tag">${slot.isOccupied ? 'Occupied' : '₹' + slot.rate + '/hr'}</div>
        </div>
      `;
      })
      .join('');
  }

  selectSlot(slotId, rate, isOccupied) {
    if (isOccupied) {
      if (window.showToast) window.showToast('⚠️ This slot is currently occupied. Please pick an open slot.', 'warning');
      return;
    }

    this.selectedSlotNumber = slotId;
    this.selectedSlotRate = rate;

    this.renderFloorGrid();
    this.calculateFare();
  }

  calculateFare() {
    const hours = parseInt(this.durationHours, 10) || 1;
    const rate = this.selectedSlotRate || (this.selectedSpot ? this.selectedSpot.hourlyRate : 40);
    const subtotal = rate * hours;
    const tax = Math.round(subtotal * 0.18 * 10) / 10;
    const total = Math.round((subtotal + tax) * 10) / 10;

    // Update Summary Card
    const elSlot = document.getElementById('summary-slot-id');
    const elRate = document.getElementById('summary-rate');
    const elHours = document.getElementById('summary-hours');
    const elSubtotal = document.getElementById('summary-subtotal');
    const elTax = document.getElementById('summary-tax');
    const elTotal = document.getElementById('summary-total');

    if (elSlot) elSlot.innerText = this.selectedSlotNumber || 'Please select a slot';
    if (elRate) elRate.innerText = `₹${rate}/hr`;
    if (elHours) elHours.innerText = `${hours} Hour(s)`;
    if (elSubtotal) elSubtotal.innerText = `₹${subtotal}`;
    if (elTax) elTax.innerText = `₹${tax}`;
    if (elTotal) elTotal.innerText = `₹${total}`;
  }

  setupEventListeners() {
    // Duration Steppers or inputs
    const durationInput = document.getElementById('booking-duration-input');
    if (durationInput) {
      durationInput.addEventListener('change', (e) => {
        this.durationHours = parseInt(e.target.value, 10) || 1;
        this.calculateFare();
      });
    }

    // Vehicle Type Chips in Booking Form
    document.querySelectorAll('.booking-veh-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.booking-veh-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.selectedVehicleType = chip.dataset.type;
      });
    });

    // Booking Submit Button
    const submitBtn = document.getElementById('btn-confirm-booking');
    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.submitBooking();
      });
    }
  }

  async submitBooking() {
    if (!this.selectedSlotNumber) {
      if (window.showToast) window.showToast('Please select a parking slot from the layout above.', 'warning');
      return;
    }

    const plateInput = document.getElementById('vehicle-plate-input');
    const plate = plateInput ? plateInput.value.trim().toUpperCase() : '';
    if (!plate) {
      if (window.showToast) window.showToast('Please enter your vehicle registration number (e.g. MH 12 AB 1234)', 'warning');
      if (plateInput) plateInput.focus();
      return;
    }

    // Require Authentication before reserving slot
    if (!window.ApnaAPI.isAuthenticated()) {
      if (window.showToast) window.showToast('Please sign in or create an account to reserve your parking slot.', 'warning');
      window.onAuthSuccessCallback = () => this.submitBooking();
      if (window.openAuthModal) window.openAuthModal('login');
      return;
    }

    const dateInput = document.getElementById('booking-date-input');
    const timeInput = document.getElementById('booking-time-input');
    const nameInput = document.getElementById('driver-name-input');
    const phoneInput = document.getElementById('driver-phone-input');
    const user = window.ApnaAPI.getUser() || {};

    const bookingPayload = {
      spotId: this.selectedSpot.id,
      floor: this.selectedFloor,
      slotNumber: this.selectedSlotNumber,
      vehicleType: this.selectedVehicleType,
      vehiclePlate: plate,
      vehicleModel: document.getElementById('vehicle-model-input')?.value || 'Standard Car',
      date: dateInput?.value || new Date().toISOString().split('T')[0],
      startTime: timeInput?.value || '12:00',
      durationHours: this.durationHours,
      customerName: (nameInput && nameInput.value.trim()) || user.name || user.full_name || 'Driver',
      customerPhone: (phoneInput && phoneInput.value.trim()) || user.phone_number || ''
    };

    const submitBtn = document.getElementById('btn-confirm-booking');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Reserving Slot...';
    }

    // 1. Create Booking record in Flask (Status: Pending)
    const bookRes = await window.ApnaAPI.createBooking(bookingPayload);

    if (!bookRes || !bookRes.success) {
      const errMsg = (bookRes && (bookRes.error || bookRes.message)) || 'Failed to reserve parking slot.';
      if (window.showToast) window.showToast(errMsg, 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Pay & Confirm Booking ➔';
      }
      return;
    }

    const bookingData = bookRes.data || (bookRes.booking ? bookRes.booking : null);
    const bookingId = (bookRes.booking && bookRes.booking.id) || (bookingData && (bookingData.booking_id || bookingData.id));

    if (!bookingId) {
      if (window.showToast) window.showToast('Invalid booking response received from server.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Pay & Confirm Booking ➔';
      }
      return;
    }

    // 2. Initialize Razorpay Payment Order on Backend
    if (submitBtn) submitBtn.innerText = 'Connecting Payment Gateway...';
    const payOrderRes = await window.ApnaAPI.createPaymentOrder(bookingId);

    if (!payOrderRes || !payOrderRes.order_id) {
      const errMsg = (payOrderRes && (payOrderRes.error || payOrderRes.message)) || 'Payment initialization failed.';
      if (window.showToast) window.showToast(errMsg, 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Pay & Confirm Booking ➔';
      }
      return;
    }

    // 3. Open Razorpay Official Checkout Popup
    const options = {
      key: payOrderRes.key_id,
      amount: payOrderRes.amount,
      currency: payOrderRes.currency || 'INR',
      name: 'Apna Parking',
      description: `Slot ${this.selectedSlotNumber} • ${this.selectedSpot.name}`,
      image: '/assets/images/1000150881.jpg',
      order_id: payOrderRes.order_id,
      handler: async (paymentResponse) => {
        // 4. Payment complete on Razorpay — Verify signature with Flask Backend
        if (window.showToast) window.showToast('Verifying payment signature with banking server...', 'info');

        const verifyRes = await window.ApnaAPI.verifyPayment({
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature
        });

        if (verifyRes && verifyRes.success) {
          if (window.showToast) window.showToast('🎉 Payment Confirmed! Your Digital QR Pass is ready.', 'success');
          const finalPass = verifyRes.booking || bookingData;
          this.renderDigitalTicketModal(finalPass);
        } else {
          const errMsg = (verifyRes && (verifyRes.error || verifyRes.message)) || 'Payment verification failed.';
          if (window.showToast) window.showToast(errMsg, 'error');
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Pay & Confirm Booking ➔';
        }
      },
      prefill: {
        name: user.name || user.full_name || '',
        email: user.email || '',
        contact: (phoneInput && phoneInput.value.trim()) || user.phone_number || ''
      },
      theme: {
        color: '#E11D74'
      },
      modal: {
        ondismiss: () => {
          if (window.showToast) window.showToast('Payment window closed. Slot reservation pending.', 'warning');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Pay & Confirm Booking ➔';
          }
        }
      }
    };

    if (typeof Razorpay !== 'undefined') {
      const rzp = new Razorpay(options);
      rzp.on('payment.failed', (failedRes) => {
        if (window.showToast) window.showToast(`Payment failed: ${failedRes.error.description}`, 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Pay & Confirm Booking ➔';
        }
      });
      rzp.open();
    } else {
      console.warn('Razorpay SDK not loaded in browser environment');
      if (window.showToast) window.showToast('Razorpay SDK unavailable. Please verify internet connectivity.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Pay & Confirm Booking ➔';
      }
    }
  }

  renderDigitalTicketModal(booking) {
    const modal = document.getElementById('ticket-pass-modal');
    if (!modal) return;

    // Populate ticket data
    document.getElementById('ticket-id-display').innerText = booking.id;
    document.getElementById('ticket-spot-name').innerText = booking.parkingName;
    document.getElementById('ticket-slot-num').innerText = `${booking.slotNumber} (${booking.floor})`;
    document.getElementById('ticket-plate').innerText = booking.vehiclePlate;
    document.getElementById('ticket-date-time').innerText = `${booking.date} | ${booking.startTime} - ${booking.endTime}`;
    document.getElementById('ticket-amount').innerText = `₹${booking.finalAmount}`;

    // Render Canvas QR Code
    this.generateQRCode(booking.qrCodeData, 'ticket-qr-canvas');

    // Show modal
    modal.classList.add('is-active');
  }

  generateQRCode(text, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 160;
    canvas.width = size;
    canvas.height = size;

    // Draw stylized QR pattern
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#E11D74'; // Brand pink QR code

    const gridSize = 21;
    const cellSize = size / gridSize;

    // Generate pseudo-deterministic QR matrix from text hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        // Corner square finders
        const isTopLeft = r < 7 && c < 7;
        const isTopRight = r < 7 && c >= gridSize - 7;
        const isBottomLeft = r >= gridSize - 7 && c < 7;

        if (isTopLeft || isTopRight || isBottomLeft) {
          const inRing = (r === 0 || r === 6 || c === 0 || c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)) && isTopLeft;
          const inRingTR = (r === 0 || r === 6 || c === gridSize - 7 || c === gridSize - 1 ||
            (r >= 2 && r <= 4 && c >= gridSize - 5 && c <= gridSize - 3)) && isTopRight;
          const inRingBL = (r === gridSize - 7 || r === gridSize - 1 || c === 0 || c === 6 ||
            (r >= gridSize - 5 && r <= gridSize - 3 && c >= 2 && c <= 4)) && isBottomLeft;

          if (inRing || inRingTR || inRingBL) {
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          }
        } else {
          // Inner matrix pattern
          const val = Math.sin(r * 12.9898 + c * 78.233 + hash) * 43758.5453;
          if (val - Math.floor(val) > 0.5) {
            ctx.fillRect(c * cellSize + 0.5, r * cellSize + 0.5, cellSize - 1, cellSize - 1);
          }
        }
      }
    }
  }
}

window.BookingController = BookingController;
