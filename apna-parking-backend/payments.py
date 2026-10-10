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
@bp.route("/api/bookings", methods=["POST"])
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

        # Resolve from frontend format if present
        spot_id_raw = data.get("spotId") or data.get("spot_id")
        slot_number = data.get("slotNumber") or data.get("slot_number")
        if not parking_id and spot_id_raw:
            try:
                loc_id = int(str(spot_id_raw).replace("spot-", ""))
                candidate = None
                if slot_number:
                    candidate = ParkingSpace.query.filter_by(location_id=loc_id, space_number=slot_number, is_active=True).first()
                if not candidate:
                    candidate = ParkingSpace.query.filter_by(location_id=loc_id, is_active=True).first()
                if candidate:
                    parking_id = candidate.parking_id
            except (ValueError, TypeError):
                pass

        vehicle_plate = data.get("vehiclePlate") or data.get("vehicle_plate")
        if not vehicle_id and vehicle_plate:
            plate_clean = str(vehicle_plate).strip().upper().replace("-", "").replace(" ", "")
            v_type_raw = str(data.get("vehicleType") or data.get("vehicle_type") or "car").lower()
            v_type = "TwoWheeler" if "bike" in v_type_raw else "FourWheeler"
            v_model = data.get("vehicleModel") or data.get("vehicle_model") or "Standard Vehicle"
            vehicle_match = Vehicle.query.filter_by(license_plate=plate_clean).first()
            if vehicle_match:
                # Plate exists — re-assign to current user if needed
                if vehicle_match.user_id != user_id:
                    vehicle_match.user_id = user_id
                    db.session.flush()
            else:
                vehicle_match = Vehicle(
                    user_id=user_id,
                    license_plate=plate_clean,
                    vehicle_type=v_type,
                    make_model=v_model,
                )
                db.session.add(vehicle_match)
                db.session.flush()
            vehicle_id = vehicle_match.vehicle_id

        date_raw = data.get("date")
        time_raw = data.get("startTime")
        duration_hrs_param = data.get("durationHours") or data.get("duration_hours")
        if date_raw and time_raw and not start_time_raw:
            try:
                dt_str = f"{date_raw} {time_raw}"
                parsed_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
                start_time_raw = parsed_dt.isoformat()
                dur = int(duration_hrs_param) if duration_hrs_param else 2
                end_time_raw = (parsed_dt + timedelta(hours=dur)).isoformat()
            except Exception:
                pass

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

        return jsonify({
            "message": "Booking created",
            "success": True,
            "booking": booking.to_dict(),
            "data": booking.to_frontend_dict(),
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("create_booking error: %s", e)
        return jsonify({"error": "Internal server error"}), 500


@bp.route("/bookings", methods=["GET"])
@bp.route("/api/bookings", methods=["GET"])
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
        return jsonify({
            "success": True,
            "count": len(bookings),
            "bookings": [b.to_dict() for b in bookings],
            "data": [b.to_frontend_dict() for b in bookings],
        }), 200
    except Exception as e:
        current_app.logger.exception("list_bookings error: %s", e)
        return jsonify({"error": "Internal server error"}), 500


@bp.route("/bookings/<booking_id_str>/cancel", methods=["POST"])
@bp.route("/api/bookings/<booking_id_str>/cancel", methods=["POST"])
@jwt_required()
def cancel_booking(booking_id_str):
    """Cancel an active booking."""
    try:
        user_id = int(get_jwt_identity())
        real_id = None
        if str(booking_id_str).startswith("AP-"):
            parts = booking_id_str.split("-")
            real_id = int(parts[-1])
        else:
            try:
                real_id = int(booking_id_str)
            except ValueError:
                return jsonify({"success": False, "message": "Invalid booking ID format"}), 400

        booking = Booking.query.filter_by(booking_id=real_id, user_id=user_id).first()
        if not booking:
            return jsonify({"success": False, "message": "Booking not found"}), 404

        booking.status = "Cancelled"
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Booking has been cancelled.",
            "data": booking.to_frontend_dict(),
            "booking": booking.to_dict(),
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("cancel_booking error: %s", e)
        return jsonify({"success": False, "message": "Internal server error"}), 500


@bp.route("/bookings/<booking_id_str>/extend", methods=["POST"])
@bp.route("/api/bookings/<booking_id_str>/extend", methods=["POST"])
@jwt_required()
def extend_booking(booking_id_str):
    """Extend duration of an active booking."""
    try:
        user_id = int(get_jwt_identity())
        real_id = None
        if str(booking_id_str).startswith("AP-"):
            parts = booking_id_str.split("-")
            real_id = int(parts[-1])
        else:
            try:
                real_id = int(booking_id_str)
            except ValueError:
                return jsonify({"success": False, "message": "Invalid booking ID format"}), 400

        booking = Booking.query.filter_by(booking_id=real_id, user_id=user_id).first()
        if not booking:
            return jsonify({"success": False, "message": "Booking not found"}), 404

        data = request.get_json(silent=True) or {}
        extra_hours = int(data.get("extraHours", 1))

        if booking.end_time:
            booking.end_time += timedelta(hours=extra_hours)
        hourly_rate = booking.parking_space.location.hourly_rate if (booking.parking_space and booking.parking_space.location) else Decimal("40.00")
        booking.total_amount += Decimal(extra_hours) * hourly_rate

        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Booking extended by {extra_hours} hour(s).",
            "data": booking.to_frontend_dict(),
            "booking": booking.to_dict(),
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("extend_booking error: %s", e)
        return jsonify({"success": False, "message": "Internal server error"}), 500


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------

@bp.route("/payments/create", methods=["POST"])
@bp.route("/api/payments/create", methods=["POST"])
@jwt_required()
@limiter.limit("10 per minute")
def create_payment():
    """Create a Razorpay order for a booking."""
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Request body must be JSON"}), 400

        raw_booking_id = data.get("booking_id")
        if not raw_booking_id:
            return jsonify({"error": "booking_id is required"}), 400

        if str(raw_booking_id).startswith("AP-"):
            parts = str(raw_booking_id).split("-")
            booking_id = int(parts[-1])
        else:
            try:
                booking_id = int(raw_booking_id)
            except ValueError:
                return jsonify({"error": "Invalid booking_id format"}), 400

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
        order = None
        last_err = None
        for attempt in range(3):
            try:
                order = client.order.create({
                    "amount": amount_in_subunits,
                    "currency": booking.currency,
                    "payment_capture": 1,
                    "notes": {"booking_id": str(booking.booking_id), "user_id": str(user_id)},
                })
                if order and "id" in order:
                    break
            except Exception as e:
                last_err = e
                current_app.logger.warning("Razorpay order creation attempt %d failed: %s", attempt + 1, e)
                import time
                time.sleep(0.5)

        if not order or "id" not in order:
            raise last_err or RuntimeError("Failed to create Razorpay order after retries")

        payment = Payment(
            booking_id=booking.booking_id,
            amount=booking.total_amount,
            payment_status="Pending",
            payment_method="UPI",
            razorpay_order_id=order["id"],
        )
        db.session.add(payment)
        db.session.commit()

        key_id = (os.getenv("RAZORPAY_KEY_ID") or "").strip()

        return jsonify({
            "success": True,
            "message": "Payment request created",
            "order_id": order["id"],
            "amount": amount_in_subunits,
            "currency": booking.currency,
            "key_id": key_id,
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
@bp.route("/api/payments/verify", methods=["POST"])
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
            return jsonify({
                "success": True,
                "message": "Payment already verified",
                "payment": payment.to_dict(),
                "booking": payment.booking.to_frontend_dict() if payment.booking else None
            }), 200

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
            return jsonify({"success": False, "error": "Payment verification failed"}), 400

        payment.razorpay_payment_id = payment_gateway_id
        payment.razorpay_signature = signature
        payment.payment_status = "Successful"

        if payment.booking:
            payment.booking.status = "Confirmed"

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Payment verified successfully",
            "payment": payment.to_dict(),
            "booking": payment.booking.to_frontend_dict() if payment.booking else None
        }), 200

    except RuntimeError as e:
        current_app.logger.error("Razorpay runtime error: %s", e)
        return jsonify({"error": "Payment gateway configuration error"}), 500
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("verify_payment error: %s", e)
        return jsonify({"error": "Internal server error"}), 500


@bp.route("/payments/history", methods=["GET"])
@bp.route("/api/payments/history", methods=["GET"])
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

