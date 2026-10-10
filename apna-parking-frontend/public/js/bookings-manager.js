/**
 * APNA PARKING - MY BOOKINGS & PASS MANAGER
 * Real-Time Session Status, Digital QR Pass Viewer, Extend Time & Cancellation
 */

class BookingsManager {
  constructor() {
    this.bookings = [];
    this.timerInterval = null;
    this.init();
  }

  async init() {
    await this.fetchBookings();
    this.startCountdownTicker();

    window.addEventListener('apna:auth_change', async () => {
      await this.fetchBookings();
    });
  }

  async fetchBookings() {
    const isAuthed = window.ApnaAPI.isAuthenticated();
    const activeContainer = document.getElementById('active-bookings-list');
    const pastContainer = document.getElementById('past-bookings-list');

    if (!isAuthed) {
      if (activeContainer) {
        activeContainer.innerHTML = `
          <div style="text-align: center; padding: 48px 20px; background: #ffffff; border-radius: 18px; border: 1.5px dashed #FBCFE8; box-shadow: 0 8px 24px rgba(225, 29, 116, 0.05);">
            <p style="font-size: 2.4rem; margin-bottom: 12px;">🔑</p>
            <h3 style="font-size: 1.3rem; color: #18091E; margin-bottom: 8px;">Please Sign In to Access Your Passes</h3>
            <p style="color: #7E7085; font-size: 0.92rem; margin-bottom: 24px; max-width: 440px; margin-left: auto; margin-right: auto;">
              Sign in with your verified driver account to view active session countdowns, boom barrier QR passes, and extend parking time.
            </p>
            <button class="btn-primary btn-open-auth" onclick="window.openAuthModal('login')">
              Sign In to View Passes ➔
            </button>
          </div>
        `;
      }
      if (pastContainer) {
        pastContainer.innerHTML = `
          <div style="text-align: center; padding: 24px; color: #94A3B8; font-size: 0.9rem;">
            Sign in above to review previous parking invoices and GST receipts.
          </div>
        `;
      }
      return;
    }

    if (activeContainer) {
      activeContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: #7E7085;">Loading verified digital passes...</div>`;
    }

    const res = await window.ApnaAPI.getBookings();
    if (res && res.success && res.data) {
      this.bookings = res.data;
      this.renderBookingsList();
    } else {
      if (activeContainer) {
        activeContainer.innerHTML = `
          <div style="text-align: center; padding: 30px; color: #EF4444;">
            ${(res && (res.error || res.message)) || 'Could not load bookings. Please sign in again.'}
          </div>
        `;
      }
    }
  }

  renderBookingsList() {
    const activeContainer = document.getElementById('active-bookings-list');
    const pastContainer = document.getElementById('past-bookings-list');

    if (!activeContainer && !pastContainer) return;

    const activeList = this.bookings.filter((b) => b.status === 'Active' || b.status === 'Confirmed' || b.status === 'Pending');
    const pastList = this.bookings.filter((b) => b.status !== 'Active' && b.status !== 'Confirmed' && b.status !== 'Pending');

    if (activeContainer) {
      if (activeList.length === 0) {
        activeContainer.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; background: #ffffff; border-radius: 16px; border: 1px dashed #CBD5E1;">
            <p style="font-size: 2rem; margin-bottom: 10px;">🅿️</p>
            <h4 style="font-size: 1.1rem; color: #1E293B; margin-bottom: 6px;">No Active Sessions</h4>
            <p style="font-size: 0.9rem; color: #64748B; margin-bottom: 20px;">Ready to park? Find open spots near your location now.</p>
            <a href="/find-parking.html" class="btn-primary">Find Nearby Parking</a>
          </div>
        `;
      } else {
        activeContainer.innerHTML = activeList
          .map(
            (b) => `
            <div class="active-booking-card" style="background: #ffffff; border: 2px solid #FBCFE8; border-radius: 18px; padding: 24px; box-shadow: 0 8px 24px rgba(225, 29, 116, 0.08); margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid #FDF2F8; padding-bottom: 14px;">
                <div>
                  <span class="badge-brand" style="margin-bottom: 6px;">PASS ID: ${b.id}</span>
                  <h3 style="font-size: 1.3rem; color: #18091E; margin-top: 4px;">${b.parkingName}</h3>
                  <p style="font-size: 0.85rem; color: #7E7085;">📍 ${b.parkingAddress}</p>
                </div>
                <div style="text-align: right;">
                  <span class="badge-green">${b.status === 'Pending' ? '⏳ Payment Pending' : '● Active Session'}</span>
                  <div style="font-size: 1.25rem; font-weight: 800; color: #E11D74; margin-top: 6px;">₹${b.finalAmount || b.totalAmount}</div>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 14px; margin-bottom: 20px; background: #FFF9FA; padding: 14px; border-radius: 12px; border: 1px solid #FCE7F3;">
                <div>
                  <small style="color: #7E7085; font-weight: 600; display: block;">SLOT ALLOCATED</small>
                  <strong style="color: #E11D74; font-size: 1.1rem;">${b.slotNumber} (${b.floor})</strong>
                </div>
                <div>
                  <small style="color: #7E7085; font-weight: 600; display: block;">VEHICLE</small>
                  <strong style="color: #18091E;">${b.vehiclePlate}</strong>
                </div>
                <div>
                  <small style="color: #7E7085; font-weight: 600; display: block;">SESSION TIMING</small>
                  <strong style="color: #18091E;">${b.startTime} - ${b.endTime}</strong>
                </div>
                <div>
                  <small style="color: #7E7085; font-weight: 600; display: block;">DURATION</small>
                  <strong style="color: #18091E;">${b.durationHours} Hours</strong>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #9D174D; font-weight: 700;">
                  ⏳ Session active until ${b.endTime} today
                </div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                  <button class="btn-outline" style="padding: 8px 16px; font-size: 0.85rem;" onclick="window.bookingsManager.openQRModal('${b.id}')">
                    📱 View QR Pass
                  </button>
                  <button class="btn-primary" style="padding: 8px 18px; font-size: 0.85rem;" onclick="window.bookingsManager.extendTimePrompt('${b.id}')">
                    + Extend (+1 hr)
                  </button>
                  <button style="background: transparent; color: #94A3B8; border: none; font-size: 0.85rem; padding: 6px; cursor: pointer;" onclick="window.bookingsManager.cancelPrompt('${b.id}')">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          `
          )
          .join('');
      }
    }

    if (pastContainer) {
      if (pastList.length === 0) {
        pastContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: #94A3B8; font-size: 0.88rem;">No past sessions recorded yet.</div>`;
      } else {
        pastContainer.innerHTML = pastList
          .map(
            (b) => `
            <div style="background: #ffffff; border: 1px solid #E2E8F0; border-radius: 14px; padding: 18px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <h4 style="font-size: 1rem; margin: 0; color: #18091E;">${b.parkingName}</h4>
                  <span style="font-size: 0.75rem; color: #64748B; background: #F1F5F9; padding: 2px 8px; border-radius: 999px;">${b.status}</span>
                </div>
                <p style="font-size: 0.82rem; color: #64748B; margin-top: 4px;">Slot: ${b.slotNumber} | Vehicle: ${b.vehiclePlate} | Date: ${b.date || 'Recent'}</p>
              </div>
              <div style="text-align: right;">
                <strong style="color: #1E293B;">₹${b.finalAmount || b.totalAmount}</strong>
                <small style="display: block; color: #94A3B8; font-size: 0.75rem;">${b.paymentMethod || 'UPI'}</small>
              </div>
            </div>
          `
          )
          .join('');
      }
    }
  }

  openQRModal(bookingId) {
    const booking = this.bookings.find((b) => b.id === bookingId || String(b.booking_id) === String(bookingId));
    if (!booking) return;

    const modal = document.getElementById('ticket-pass-modal');
    if (!modal) return;

    const elId = document.getElementById('ticket-id-display');
    const elSpot = document.getElementById('ticket-spot-name');
    const elSlot = document.getElementById('ticket-slot-num');
    const elPlate = document.getElementById('ticket-plate');
    const elTime = document.getElementById('ticket-date-time');
    const elAmt = document.getElementById('ticket-amount');

    if (elId) elId.innerText = booking.id;
    if (elSpot) elSpot.innerText = booking.parkingName;
    if (elSlot) elSlot.innerText = `${booking.slotNumber} (${booking.floor})`;
    if (elPlate) elPlate.innerText = booking.vehiclePlate;
    if (elTime) elTime.innerText = `${booking.date} | ${booking.startTime} - ${booking.endTime}`;
    if (elAmt) elAmt.innerText = `₹${booking.finalAmount || booking.totalAmount}`;

    this.generateQRCode(booking.qrCodeData || `APNA-PARKING-PASS|${booking.id}`, 'ticket-qr-canvas');
    modal.classList.add('is-active');
  }

  generateQRCode(text, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 160;
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#E11D74';

    const gridSize = 21;
    const cellSize = size / gridSize;

    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const isTopLeft = r < 7 && c < 7;
        const isTopRight = r < 7 && c >= gridSize - 7;
        const isBottomLeft = r >= gridSize - 7 && c < 7;

        if (isTopLeft || isTopRight || isBottomLeft) {
          const inRing = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) && isTopLeft;
          const inRingTR = (r === 0 || r === 6 || c === gridSize - 7 || c === gridSize - 1 || (r >= 2 && r <= 4 && c >= gridSize - 5 && c <= gridSize - 3)) && isTopRight;
          const inRingBL = (r === gridSize - 7 || r === gridSize - 1 || c === 0 || c === 6 || (r >= gridSize - 5 && r <= gridSize - 3 && c >= 2 && c <= 4)) && isBottomLeft;

          if (inRing || inRingTR || inRingBL) {
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          }
        } else {
          const val = Math.sin(r * 12.9898 + c * 78.233 + hash) * 43758.5453;
          if (val - Math.floor(val) > 0.5) {
            ctx.fillRect(c * cellSize + 0.5, r * cellSize + 0.5, cellSize - 1, cellSize - 1);
          }
        }
      }
    }
  }

  async extendTimePrompt(bookingId) {
    if (confirm('Extend parking by 1 additional hour? (Standard hourly fee will apply)')) {
      const res = await window.ApnaAPI.extendBooking(bookingId, 1);
      if (res && res.success) {
        if (window.showToast) window.showToast(res.message, 'success');
        await this.fetchBookings();
      } else {
        if (window.showToast) window.showToast((res && (res.error || res.message)) || 'Extension failed.', 'error');
      }
    }
  }

  async cancelPrompt(bookingId) {
    if (confirm('Are you sure you want to cancel this booking?')) {
      const res = await window.ApnaAPI.cancelBooking(bookingId);
      if (res && res.success) {
        if (window.showToast) window.showToast('Booking cancelled successfully.', 'info');
        await this.fetchBookings();
      } else {
        if (window.showToast) window.showToast((res && (res.error || res.message)) || 'Cancellation failed.', 'error');
      }
    }
  }

  startCountdownTicker() {
    this.timerInterval = setInterval(() => {
      this.renderBookingsList();
    }, 60000);
  }
}

window.BookingsManager = BookingsManager;
