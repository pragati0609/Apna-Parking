import os
import logging
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import razorpay

from extensions import db, limiter
from models import Booking, Payment, ParkingSpace, Vehicle, Location
from razorpay_client import get_razorpay_client

bp = Blueprint("payments", __name__)


# ---------------------------------------------------------------------------
# Bookings
# ---------------------------------------------------------------------------

@bp.route("/bookings", methods=["POST"])
@jwt_required()
def create_booking():
    """Create a parking or service booking that a payment can later be attached to."""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Request body must be JSON"}), 400

        item_name = str(data.get("item_name", "")).strip()
        raw_amount = data.get("amount")
        currency = str(data.get("currency", "INR")).strip().upper() or "INR"

        parking_id = data.get("parking_id")
        vehicle_id = data.get("vehicle_id")
        start_time_raw = data.get("start_time")
        end_time_raw = data.get("end_time")

        if not item_name and not parking_id:
            return jsonify({"error": "item_name or parking_id is required"}), 400

        # Validate amount early
        amount = None
        if raw_amount is not None:
            try:
                amount = Decimal(str(raw_amount))
            except (InvalidOperation, ValueError):
                return jsonify({"error": "amount must be a valid number"}), 400
            if amount <= 0:
                return jsonify({"error": "amount must be greater than 0"}), 400
        elif not parking_id:
            return jsonify({"error": "amount is required"}), 400

        # Parse or default start and end times
        now_utc = datetime.now(timezone.utc)
        if start_time_raw:
            try:
                start_time = datetime.fromisoformat(str(start_time_raw).replace("Z", "+00:00"))
            except ValueError:
                return jsonify({"error": "start_time must be in valid ISO format"}), 400
        else:
            start_time = now_utc

        if end_time_raw:
            try:
                end_time = datetime.fromisoformat(str(end_time_raw).replace("Z", "+00:00"))
            except ValueError:
                return jsonify({"error": "end_time must be in valid ISO format"}), 400
        else:
            end_time = start_time + timedelta(hours=2)

        if start_time >= end_time:
            return jsonify({"error": "start_time must be before end_time"}), 400

        # Ensure a valid Vehicle exists for this user
        if vehicle_id:
            vehicle = Vehicle.query.filter_by(vehicle_id=vehicle_id, user_id=user_id).first()
            if not vehicle:
                return jsonify({"error": "Vehicle not found or does not belong to user"}), 404
        else:
            vehicle = Vehicle.query.filter_by(user_id=user_id).first()
            if not vehicle:
                plate_num = f"MH12{user_id % 90 + 10:02d}{user_id % 9000 + 1000:04d}"
                vehicle = Vehicle(
                    user_id=user_id,
                    license_plate=plate_num,
                    vehicle_type="FourWheeler",
                    make_model="Standard Vehicle",
                )
                db.session.add(vehicle)
                db.session.flush()

        # Ensure a valid ParkingSpace exists and check availability
        if parking_id:
            space = ParkingSpace.query.filter_by(parking_id=parking_id, is_active=True).first()
            if not space:
                return jsonify({"error": "Parking space not found or inactive"}), 404

            overlap = Booking.query.filter(
                Booking.parking_id == space.parking_id,
                Booking.status.in_(["Pending", "Confirmed"]),
                Booking.start_time < end_time,
                Booking.end_time > start_time,
            ).first()
            if overlap:
                return jsonify({"error": "Parking space is already booked for the selected time window"}), 409
        else:
            # Auto-assign an available space or create a new slot
            all_active = ParkingSpace.query.filter_by(is_active=True).all()
            space = None
            for candidate in all_active:
                overlap = Booking.query.filter(
                    Booking.parking_id == candidate.parking_id,
                    Booking.status.in_(["Pending", "Confirmed"]),
                    Booking.start_time < end_time,
                    Booking.end_time > start_time,
                ).first()
                if not overlap:
                    space = candidate
                    break

            if not space:
                loc = Location.query.first()
                if not loc:
                    loc = Location(
                        location_name="Downtown Central Garage",
                        address="100 Main St",
                        city="Mumbai",
                        state="Maharashtra",
                        postal_code="400001",
                        hourly_rate=Decimal("60.00"),
                    )
                    db.session.add(loc)
                    db.session.flush()
                slot_index = len(all_active) + 1
                space = ParkingSpace(location_id=loc.location_id, space_number=f"A-{100 + slot_index}", is_active=True)
                db.session.add(space)
                db.session.flush()

        # Compute amount if not explicitly passed
        if amount is None:
            duration_hours = Decimal(max(1.0, (end_time - start_time).total_seconds() / 3600.0))
            hourly_rate = space.location.hourly_rate if space.location else Decimal("50.00")
            amount = round(duration_hours * hourly_rate, 2)

        booking = Booking(
            user_id=user_id,
            vehicle_id=vehicle.vehicle_id,
            parking_id=space.parking_id,
            start_time=start_time,
            end_time=end_time,
            total_amount=amount,
            status="Pending",
        )
        db.session.add(booking)
        db.session.commit()

        return jsonify({"message": "Booking created", "booking": booking.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("create_booking error: %s", e)
        return jsonify({"error": "Internal server error"}), 500


@bp.route("/bookings", methods=["GET"])
@jwt_required()
def list_bookings():
    """List the current user's bookings."""
    try:
        user_id = int(get_jwt_identity())
        bookings = (
            Booking.query.filter_by(user_id=user_id)
            .order_by(Booking.created_at.desc())
            .all()
        )
        return jsonify({"bookings": [b.to_dict() for b in bookings]}), 200
    except Exception as e:
        current_app.logger.exception("list_bookings error: %s", e)
        return jsonify({"error": "Internal server error"}), 500


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------

@bp.route("/payments/create", methods=["POST"])
@jwt_required()
@limiter.limit("10 per minute")
def create_payment():
    """Create a Razorpay order for a booking."""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Request body must be JSON"}), 400

        booking_id = data.get("booking_id")
        if not booking_id:
            return jsonify({"error": "booking_id is required"}), 400

        booking = Booking.query.filter_by(booking_id=booking_id, user_id=user_id).first()
        if not booking:
            return jsonify({"error": "Booking not found"}), 404

        if booking.status not in ["Pending", "pending"]:
            return jsonify({"error": f"Booking is already '{booking.status}'"}), 409

        existing_payment = Payment.query.filter_by(booking_id=booking.booking_id).filter(
            Payment.payment_status.in_(["Pending", "Successful"])
        ).first()
        if existing_payment:
            return jsonify({"error": "A payment request already exists for this booking"}), 409

        amount_in_subunits = int((booking.total_amount * 100).to_integral_value())

        client = get_razorpay_client()
        order = client.order.create({
            "amount": amount_in_subunits,
            "currency": booking.currency,
            "payment_capture": 1,
            "notes": {"booking_id": str(booking.booking_id), "user_id": str(user_id)},
        })

        payment = Payment(
            booking_id=booking.booking_id,
            amount=booking.total_amount,
            payment_status="Pending",
            payment_method="UPI",
            razorpay_order_id=order["id"],
        )
        db.session.add(payment)
        db.session.commit()

        return jsonify({
            "message": "Payment request created",
            "order_id": order["id"],
            "amount": amount_in_subunits,
            "currency": booking.currency,
            "key_id": os.getenv("RAZORPAY_KEY_ID"),
            "payment_id": payment.payment_id,
        }), 201

    except razorpay.errors.BadRequestError as e:
        current_app.logger.warning("Razorpay order creation rejected: %s", e)
        return jsonify({"error": "Payment gateway rejected the order creation request"}), 400
    except RuntimeError as e:
        current_app.logger.error("Razorpay configuration error: %s", e)
        return jsonify({"error": "Payment gateway is not configured"}), 500
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("create_payment error: %s", e)
        return jsonify({"error": "Internal server error"}), 500


@bp.route("/payments/verify", methods=["POST"])
@jwt_required()
@limiter.limit("10 per minute")
def verify_payment():
    """Verify a completed Razorpay payment using the returned signature."""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Request body must be JSON"}), 400

        order_id = data.get("razorpay_order_id")
        payment_gateway_id = data.get("razorpay_payment_id")
        signature = data.get("razorpay_signature")

        if not order_id or not payment_gateway_id or not signature:
            return jsonify({
                "error": "razorpay_order_id, razorpay_payment_id and razorpay_signature are required"
            }), 400

        payment = Payment.query.filter_by(razorpay_order_id=order_id).first()
        if not payment:
            return jsonify({"error": "Payment not found"}), 404

        if payment.user_id != user_id:
            return jsonify({"error": "Not allowed to verify this payment"}), 403

        if payment.payment_status in ["Successful", "paid", "Paid"]:
            return jsonify({"message": "Payment already verified", "payment": payment.to_dict()}), 200

        client = get_razorpay_client()
        try:
            client.utility.verify_payment_signature({
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_gateway_id,
                "razorpay_signature": signature,
            })
        except razorpay.errors.SignatureVerificationError:
            payment.payment_status = "Failed"
            db.session.commit()
            return jsonify({"error": "Payment verification failed"}), 400

        payment.razorpay_payment_id = payment_gateway_id
        payment.razorpay_signature = signature
        payment.payment_status = "Successful"

        if payment.booking:
            payment.booking.status = "Confirmed"

        db.session.commit()

        return jsonify({"message": "Payment verified successfully", "payment": payment.to_dict()}), 200

    except RuntimeError as e:
        current_app.logger.error("Razorpay runtime error: %s", e)
        return jsonify({"error": "Payment gateway configuration error"}), 500
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("verify_payment error: %s", e)
        return jsonify({"error": "Internal server error"}), 500


@bp.route("/payments/history", methods=["GET"])
@jwt_required()
def payment_history():
    """Return the current user's payment/booking history, paginated."""
    try:
        user_id = int(get_jwt_identity())

        try:
            page = max(int(request.args.get("page", 1)), 1)
            per_page = min(max(int(request.args.get("per_page", 10)), 1), 50)
        except ValueError:
            return jsonify({"error": "page and per_page must be integers"}), 400

        pagination = (
            Payment.query.join(Booking)
            .filter(Booking.user_id == user_id)
            .order_by(Payment.paid_at.desc())
            .paginate(page=page, per_page=per_page, error_out=False)
        )

        return jsonify({
            "payments": [p.to_dict() for p in pagination.items],
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total_items": pagination.total,
            "total_pages": pagination.pages,
        }), 200

    except Exception as e:
        current_app.logger.exception("payment_history error: %s", e)
        return jsonify({"error": "Internal server error"}), 500

