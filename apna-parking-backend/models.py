from datetime import datetime, timezone
from extensions import db


def utc_now():
    return datetime.now(timezone.utc)


class Location(db.Model):
    __tablename__ = "Locations"

    location_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    location_name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(50), nullable=False)
    state = db.Column(db.String(50), nullable=False)
    postal_code = db.Column(db.String(20), nullable=True)
    hourly_rate = db.Column(db.Numeric(10, 2), nullable=False, default=50.00)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    daily_rate = db.Column(db.Numeric(10, 2), nullable=True, default=350.00)
    monthly_rate = db.Column(db.Numeric(10, 2), nullable=True, default=2499.00)
    rating = db.Column(db.Float, nullable=True, default=4.5)
    reviews_count = db.Column(db.Integer, nullable=True, default=50)
    category = db.Column(db.String(100), nullable=True, default="Commercial Mall & Plaza")
    image = db.Column(db.String(255), nullable=True, default="/assets/images/garage_preview.jpg")
    banner_image = db.Column(db.String(500), nullable=True, default="https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80")
    description = db.Column(db.Text, nullable=True)
    vehicle_types = db.Column(db.String(100), nullable=True, default="car,bike,ev,truck")
    amenities = db.Column(db.Text, nullable=True)
    operating_hours = db.Column(db.String(50), nullable=True, default="24 Hours Open")
    created_at = db.Column(db.DateTime, default=utc_now)

    parking_spaces = db.relationship("ParkingSpace", backref="location", lazy=True)

    @property
    def id(self):
        return self.location_id

    @property
    def lat(self):
        return self.latitude

    @property
    def lng(self):
        return self.longitude

    def to_dict(self):
        return {
            "location_id": self.location_id,
            "id": f"spot-{self.location_id}",
            "location_name": self.location_name,
            "name": self.location_name,
            "address": self.address,
            "city": self.city,
            "state": self.state,
            "postal_code": self.postal_code,
            "lat": float(self.latitude) if self.latitude is not None else None,
            "lng": float(self.longitude) if self.longitude is not None else None,
            "latitude": float(self.latitude) if self.latitude is not None else None,
            "longitude": float(self.longitude) if self.longitude is not None else None,
            "hourly_rate": float(self.hourly_rate),
            "hourlyRate": float(self.hourly_rate),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def to_frontend_dict(self):
        v_types = [t.strip() for t in (self.vehicle_types or "car,bike,ev,truck").split(",") if t.strip()]
        amenities_list = [a.strip() for a in (self.amenities or "CCTV Surveillance,24/7 Security Guard,Covered Basement,EV Fast Charging").split(",") if a.strip()]
        
        floors_map = {}
        total_spots = 0
        available_spots = 0
        for space in self.parking_spaces:
            if not space.is_active:
                continue
            fl_name = space.floor or "B1"
            if fl_name not in floors_map:
                floors_map[fl_name] = []
            slot_occupied = space.is_currently_occupied
            total_spots += 1
            if not slot_occupied:
                available_spots += 1
            floors_map[fl_name].append(space.to_frontend_slot_dict())
            
        floors = []
        for fl_key, slots in sorted(floors_map.items()):
            free_count = sum(1 for s in slots if not s["isOccupied"])
            floors.append({
                "floor": fl_key,
                "name": f"Basement {fl_key.replace('B', '')}" if fl_key.startswith("B") else f"Floor {fl_key}",
                "total": len(slots),
                "available": free_count,
                "slots": slots
            })
            
        if not floors:
            total_spots = 60
            available_spots = 24
            floors = [
                {"floor": "B1", "name": "Basement 1", "total": 20, "available": 8, "slots": []},
                {"floor": "B2", "name": "Basement 2", "total": 20, "available": 10, "slots": []},
                {"floor": "B3", "name": "Basement 3", "total": 20, "available": 6, "slots": []},
            ]

        return {
            "id": f"spot-{self.location_id}",
            "location_id": self.location_id,
            "name": self.location_name,
            "address": self.address,
            "area": self.address.split(",")[0] if "," in self.address else self.address,
            "city": self.city,
            "lat": float(self.latitude) if self.latitude is not None else 18.5204,
            "lng": float(self.longitude) if self.longitude is not None else 73.8415,
            "hourlyRate": float(self.hourly_rate),
            "dailyRate": float(self.daily_rate) if self.daily_rate else 350.0,
            "monthlyRate": float(self.monthly_rate) if self.monthly_rate else 2499.0,
            "rating": float(self.rating) if self.rating else 4.5,
            "reviewsCount": int(self.reviews_count) if self.reviews_count else 50,
            "totalSpots": total_spots,
            "availableSpots": available_spots,
            "status": "Available" if available_spots > 0 else "Full",
            "category": self.category or "Commercial Mall & Plaza",
            "image": self.image or "/assets/images/garage_preview.jpg",
            "bannerImage": self.banner_image or "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
            "description": self.description or "Spacious and secure parking facility.",
            "vehicleTypes": v_types,
            "amenities": amenities_list,
            "operatingHours": self.operating_hours or "24 Hours Open",
            "floors": floors
        }


class User(db.Model):
    __tablename__ = "Users"

    user_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False, index=True)
    phone_number = db.Column(db.String(20), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now)

    vehicles = db.relationship("Vehicle", backref="user", lazy=True, cascade="all, delete-orphan")
    bookings = db.relationship("Booking", backref="user", lazy=True)

    @property
    def id(self):
        return self.user_id

    @property
    def name(self):
        return self.full_name

    @name.setter
    def name(self, val):
        self.full_name = val

    def to_dict(self):
        return {
            "id": self.user_id,
            "user_id": self.user_id,
            "full_name": self.full_name,
            "name": self.full_name,
            "email": self.email,
            "phone_number": self.phone_number,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Vehicle(db.Model):
    __tablename__ = "Vehicles"

    vehicle_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("Users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    license_plate = db.Column(db.String(20), unique=True, nullable=False)
    vehicle_type = db.Column(db.Enum("TwoWheeler", "FourWheeler", name="vehicle_type_enum"), nullable=False, default="FourWheeler")
    make_model = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=utc_now)

    bookings = db.relationship("Booking", backref="vehicle", lazy=True)

    @property
    def id(self):
        return self.vehicle_id

    def to_dict(self):
        return {
            "vehicle_id": self.vehicle_id,
            "user_id": self.user_id,
            "license_plate": self.license_plate,
            "vehicle_type": self.vehicle_type,
            "make_model": self.make_model,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ParkingSpace(db.Model):
    __tablename__ = "ParkingSpaces"

    parking_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    location_id = db.Column(db.Integer, db.ForeignKey("Locations.location_id", ondelete="RESTRICT"), nullable=False, index=True)
    space_number = db.Column(db.String(20), nullable=False)
    space_type = db.Column(
        db.Enum("Standard", "Compact", "EV_Charging", "Handicapped", name="space_type_enum"),
        nullable=False,
        default="Standard",
    )
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    floor = db.Column(db.String(20), nullable=False, default="B1")
    rate = db.Column(db.Numeric(10, 2), nullable=True)
    created_at = db.Column(db.DateTime, default=utc_now)

    bookings = db.relationship("Booking", backref="parking_space", lazy=True)

    @property
    def id(self):
        return self.parking_id

    @property
    def is_currently_occupied(self):
        now = utc_now()
        for b in self.bookings:
            if b.status in ["Pending", "Confirmed"]:
                # If start_time or end_time is naive, compare safely
                s_time = b.start_time.replace(tzinfo=timezone.utc) if b.start_time and b.start_time.tzinfo is None else b.start_time
                e_time = b.end_time.replace(tzinfo=timezone.utc) if b.end_time and b.end_time.tzinfo is None else b.end_time
                if s_time and e_time and s_time <= now <= e_time:
                    return True
        return False

    def to_frontend_slot_dict(self):
        is_ev = (self.space_type == "EV_Charging")
        slot_type = "ev" if is_ev else ("bike" if "compact" in (self.space_type or "").lower() else "car")
        base_rate = float(self.rate) if self.rate else (float(self.location.hourly_rate) if self.location else 40.0)
        return {
            "id": self.space_number,
            "number": self.space_number.split("-")[-1] if "-" in self.space_number else self.space_number,
            "floor": self.floor or "B1",
            "type": slot_type,
            "isEV": is_ev,
            "isOccupied": self.is_currently_occupied,
            "rate": base_rate,
            "parking_id": self.parking_id
        }

    def to_dict(self):
        return {
            "parking_id": self.parking_id,
            "id": self.parking_id,
            "location_id": self.location_id,
            "space_number": self.space_number,
            "space_type": self.space_type,
            "floor": self.floor,
            "rate": float(self.rate) if self.rate else None,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Booking(db.Model):
    __tablename__ = "Bookings"

    booking_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("Users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("Vehicles.vehicle_id", ondelete="RESTRICT"), nullable=False, index=True)
    parking_id = db.Column(db.Integer, db.ForeignKey("ParkingSpaces.parking_id", ondelete="RESTRICT"), nullable=False, index=True)

    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)

    status = db.Column(
        db.Enum("Pending", "Confirmed", "Completed", "Cancelled", name="booking_status_enum"),
        nullable=False,
        default="Confirmed",
    )
    total_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    created_at = db.Column(db.DateTime, default=utc_now)

    payments = db.relationship("Payment", backref="booking", lazy=True)
    cancellations = db.relationship("Cancellation", backref="booking", lazy=True)

    @property
    def id(self):
        return self.booking_id

    @property
    def amount(self):
        return self.total_amount

    @amount.setter
    def amount(self, val):
        self.total_amount = val

    @property
    def currency(self):
        return "INR"

    @property
    def item_name(self):
        slot_name = self.parking_space.space_number if self.parking_space else f"Slot #{self.parking_id}"
        return f"Parking Booking ({slot_name})"

    def to_dict(self):
        return {
            "id": self.booking_id,
            "booking_id": self.booking_id,
            "user_id": self.user_id,
            "vehicle_id": self.vehicle_id,
            "parking_id": self.parking_id,
            "item_name": self.item_name,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "amount": float(self.total_amount),
            "total_amount": float(self.total_amount),
            "currency": self.currency,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Cancellation(db.Model):
    __tablename__ = "Cancellations"

    cancellation_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("Bookings.booking_id", ondelete="CASCADE"), nullable=False, index=True)
    cancelled_by_user_id = db.Column(db.Integer, db.ForeignKey("Users.user_id", ondelete="RESTRICT"), nullable=False, index=True)
    cancellation_reason = db.Column(db.String(255), default="User requested cancellation")
    refund_amount = db.Column(db.Numeric(10, 2), default=0.00)
    cancelled_at = db.Column(db.DateTime, default=utc_now)

    def to_dict(self):
        return {
            "cancellation_id": self.cancellation_id,
            "booking_id": self.booking_id,
            "cancelled_by_user_id": self.cancelled_by_user_id,
            "cancellation_reason": self.cancellation_reason,
            "refund_amount": float(self.refund_amount),
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
        }


class Payment(db.Model):
    __tablename__ = "Payments"

    payment_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("Bookings.booking_id", ondelete="RESTRICT"), nullable=False, index=True)

    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_status = db.Column(
        db.Enum("Pending", "Successful", "Failed", "Refunded", name="payment_status_enum"),
        nullable=False,
        default="Successful",
    )
    payment_method = db.Column(
        db.Enum("Card", "UPI", "NetBanking", "Cash", "Wallet", name="payment_method_enum"),
        nullable=False,
        default="UPI",
    )
    transaction_ref = db.Column(db.String(100), nullable=True)

    # Razorpay integration fields
    razorpay_order_id = db.Column(db.String(100), unique=True, nullable=True, index=True)
    razorpay_payment_id = db.Column(db.String(100), nullable=True)
    razorpay_signature = db.Column(db.String(255), nullable=True)

    paid_at = db.Column(db.DateTime, default=utc_now)

    @property
    def id(self):
        return self.payment_id

    @property
    def status(self):
        return self.payment_status

    @status.setter
    def status(self, val):
        self.payment_status = val

    @property
    def user_id(self):
        return self.booking.user_id if self.booking else None

    @property
    def currency(self):
        return "INR"

    @property
    def created_at(self):
        return self.paid_at

    def to_dict(self):
        return {
            "id": self.payment_id,
            "payment_id": self.payment_id,
            "booking_id": self.booking_id,
            "razorpay_order_id": self.razorpay_order_id,
            "razorpay_payment_id": self.razorpay_payment_id,
            "amount": float(self.amount),
            "currency": self.currency,
            "status": self.payment_status,
            "payment_status": self.payment_status,
            "payment_method": self.payment_method,
            "created_at": self.paid_at.isoformat() if self.paid_at else None,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "booking": {
                "id": self.booking.booking_id,
                "booking_id": self.booking.booking_id,
                "item_name": self.booking.item_name,
                "status": self.booking.status,
            } if self.booking else None,
        }
