/**
 * APNA PARKING - LIVE MAP & RADAR CONTROLLER
 * Integrates Leaflet, GPS Geolocation, Custom Pink Pins, and Distance Sorting
 */

class ParkingMapController {
  constructor(mapContainerId, options = {}) {
    this.mapContainerId = mapContainerId;
    this.options = Object.assign(
      {
        defaultLat: 18.5204, // Default to Pune Center (FC Road area)
        defaultLng: 73.8415,
        defaultZoom: 14,
        isInteractivePage: false,
        onSpotSelect: null
      },
      options
    );

    this.map = null;
    this.userMarker = null;
    this.userAccuracyCircle = null;
    this.spotMarkers = [];
    this.userCoords = { lat: this.options.defaultLat, lng: this.options.defaultLng };
    this.hasUserGPS = false;
    this.currentSpots = [];
    this.activeVehicleType = 'all';

    this.init();
  }

  init() {
    const container = document.getElementById(this.mapContainerId);
    if (!container) return;

    // Initialize Leaflet Map
    this.map = L.map(this.mapContainerId, {
      center: [this.userCoords.lat, this.userCoords.lng],
      zoom: this.options.defaultZoom,
      zoomControl: true
    });

    // Clean OpenStreetMap Tile Layer with subtle styling
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    // Try detecting user real-time GPS location
    this.detectUserLocation();

    // Load initial spots
    this.fetchAndRenderNearbySpots();
  }

  detectUserLocation(onSuccessCallback) {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.userCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          this.hasUserGPS = true;
          this.renderUserLocationMarker();
          this.fetchAndRenderNearbySpots();
          
          if (onSuccessCallback) onSuccessCallback(this.userCoords);
          if (window.showToast) {
            window.showToast('📍 Live GPS location detected successfully!', 'success');
          }
        },
        (error) => {
          console.warn('Geolocation access denied or unavailable, using Pune center default', error);
          this.renderUserLocationMarker(true);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      this.renderUserLocationMarker(true);
    }
  }

  renderUserLocationMarker(isDefault = false) {
    if (!this.map) return;

    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
    }
    if (this.userAccuracyCircle) {
      this.map.removeLayer(this.userAccuracyCircle);
    }

    const userBeaconIcon = L.divIcon({
      className: 'user-gps-beacon-container',
      html: `
        <div class="user-gps-beacon">
          <div class="beacon-wave"></div>
          <div class="beacon-center"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    this.userMarker = L.marker([this.userCoords.lat, this.userCoords.lng], {
      icon: userBeaconIcon,
      zIndexOffset: 1000
    }).addTo(this.map);

    this.userMarker.bindTooltip(
      isDefault ? '📍 Showing Pune FC Road (Default Location)' : '📍 Your Live Location',
      { permanent: false, direction: 'top' }
    );

    // Pan smoothly
    this.map.setView([this.userCoords.lat, this.userCoords.lng], this.options.defaultZoom);
  }

  async fetchAndRenderNearbySpots() {
    try {
      const res = await window.ApnaAPI.getNearbySpots(
        this.userCoords.lat,
        this.userCoords.lng,
        this.activeVehicleType
      );

      if (res && res.success && res.data) {
        this.currentSpots = res.data;
        this.renderSpotMarkers();
        this.renderSpotsList();
      }
    } catch (err) {
      console.error('Error fetching spots for map', err);
    }
  }

  renderSpotMarkers() {
    if (!this.map) return;

    // Clear existing markers
    this.spotMarkers.forEach((m) => this.map.removeLayer(m));
    this.spotMarkers = [];

    this.currentSpots.forEach((spot) => {
      // Create Custom Pink Pin DivIcon
      const pinIcon = L.divIcon({
        className: 'custom-map-pin-wrapper',
        html: `
          <div class="custom-parking-pin" id="pin-${spot.id}">
            <span>🅿️</span> ₹${spot.hourlyRate}/h
          </div>
        `,
        iconSize: [85, 34],
        iconAnchor: [42, 34],
        popupAnchor: [0, -34]
      });

      const marker = L.marker([spot.lat, spot.lng], { icon: pinIcon }).addTo(this.map);

      // Popup card content
      const popupHtml = `
        <div class="popup-parking-card">
          <img src="${spot.image}" class="popup-thumb" alt="${spot.name}" onerror="this.src='https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=400&q=80'" />
          <h4 class="popup-title">${spot.name}</h4>
          <p class="popup-address">📍 ${spot.area}</p>
          <div class="popup-meta">
            <span class="popup-price">₹${spot.hourlyRate} <span>/hour</span></span>
            <span class="badge-green">${spot.availableSpots} Free</span>
          </div>
          <a href="/book-slot.html?spotId=${spot.id}" class="popup-btn">Book Slot Now</a>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        this.highlightCardInList(spot.id);
        if (this.options.onSpotSelect) {
          this.options.onSpotSelect(spot);
        }
      });

      this.spotMarkers.push(marker);
    });
  }

  renderSpotsList() {
    // Check if mini-list container exists (Home page)
    const homeList = document.getElementById('home-nearby-spots-list');
    if (homeList) {
      homeList.innerHTML = this.currentSpots
        .slice(0, 4)
        .map(
          (spot) => `
          <div class="parking-card-mini" data-id="${spot.id}" onclick="window.focusSpotOnMap('${spot.id}')">
            <img src="${spot.image}" class="parking-mini-thumb" alt="${spot.name}" onerror="this.src='https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=300&q=80'">
            <div class="parking-mini-info">
              <div class="parking-mini-header">
                <div>
                  <h4 class="parking-mini-title">${spot.name}</h4>
                  <p class="parking-mini-address">${spot.area}</p>
                </div>
                <span class="badge-green">${spot.availableSpots} Left</span>
              </div>
              <div class="parking-mini-meta">
                <div class="parking-mini-price">₹${spot.hourlyRate} <span>/hr</span></div>
                <span class="parking-distance-tag">📍 ${spot.distanceKm || 0.5} km away</span>
                <a href="/book-slot.html?spotId=${spot.id}" class="btn-primary" style="padding: 4px 12px; font-size: 0.78rem;" onclick="event.stopPropagation();">Book</a>
              </div>
            </div>
          </div>
        `
        )
        .join('');
    }

    // Check if detailed list exists (find-parking.html)
    const finderList = document.getElementById('finder-spots-list');
    if (finderList) {
      const countEl = document.getElementById('finder-results-count');
      if (countEl) countEl.innerText = `${this.currentSpots.length} Parking Locations Found`;

      finderList.innerHTML = this.currentSpots
        .map(
          (spot) => `
          <div class="parking-card-detailed" id="card-${spot.id}" data-id="${spot.id}" onclick="window.focusSpotOnMap('${spot.id}')">
            <div class="card-top-row">
              <img src="${spot.image}" class="card-img-thumb" alt="${spot.name}" onerror="this.src='https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=300&q=80'">
              <div class="card-content-area">
                <div class="card-name-rating">
                  <h4>${spot.name}</h4>
                  <span class="rating-pill">★ ${spot.rating} (${spot.reviewsCount})</span>
                </div>
                <p class="card-address-text">📍 ${spot.address}</p>
                <div class="card-amenities-tags">
                  ${spot.amenities.slice(0, 3).map((a) => `<span class="amenity-badge">${a}</span>`).join('')}
                </div>
              </div>
            </div>
            <div class="card-footer-row">
              <div class="rate-display">₹${spot.hourlyRate} <span>/hr</span></div>
              <div class="card-action-btns">
                <a href="https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}" target="_blank" class="btn-card-directions" onclick="event.stopPropagation();">
                  🧭 Directions
                </a>
                <a href="/book-slot.html?spotId=${spot.id}" class="btn-card-book" onclick="event.stopPropagation();">
                  Book Slot
                </a>
              </div>
            </div>
          </div>
        `
        )
        .join('');
    }
  }

  setVehicleFilter(type) {
    this.activeVehicleType = type;
    this.fetchAndRenderNearbySpots();
  }

  focusSpot(spotId) {
    const spot = this.currentSpots.find((s) => s.id === spotId);
    if (!spot || !this.map) return;

    this.map.flyTo([spot.lat, spot.lng], 16, { animate: true, duration: 1 });

    const marker = this.spotMarkers.find(
      (m) => m.getLatLng().lat === spot.lat && m.getLatLng().lng === spot.lng
    );
    if (marker) {
      setTimeout(() => marker.openPopup(), 400);
    }

    this.highlightCardInList(spotId);
  }

  highlightCardInList(spotId) {
    document.querySelectorAll('.parking-card-mini, .parking-card-detailed').forEach((card) => {
      if (card.dataset.id === spotId) {
        card.classList.add('is-selected', 'is-active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        card.classList.remove('is-selected', 'is-active');
      }
    });
  }

  recenterToUser() {
    if (this.map && this.userCoords) {
      this.map.flyTo([this.userCoords.lat, this.userCoords.lng], 15, { animate: true });
    }
  }
}

// Global helper for card clicks
window.focusSpotOnMap = function (spotId) {
  if (window.activeMapController) {
    window.activeMapController.focusSpot(spotId);
  }
};

window.ParkingMapController = ParkingMapController;
