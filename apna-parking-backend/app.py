import os
import re
import logging
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
from email_validator import validate_email, EmailNotValidError
from sqlalchemy.exc import IntegrityError
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, get_jwt
)

from flask_swagger_ui import get_swaggerui_blueprint
from flask_cors import CORS

from extensions import db, jwt, blacklisted_tokens, limiter
from models import User
from payments import bp as payments_bp
from parking_spots import bp as parking_spots_bp
from seed_data import seed_parking_data

load_dotenv()

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apna-parking-frontend", "public"))
if not os.path.exists(FRONTEND_DIR):
    FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "public"))

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Validate environment settings early to prevent silent misconfigurations
database_url = os.getenv("DATABASE_URL")
jwt_secret = os.getenv("JWT_SECRET_KEY")

if not database_url:
    database_url = "sqlite:///booking_app.db"
    app.logger.warning("DATABASE_URL is not set. Defaulting to local SQLite fallback.")

if not jwt_secret:
    jwt_secret = "dev-insecure-jwt-key-replace-in-production"
    app.logger.warning("JWT_SECRET_KEY is not set. Using dev secret; please set in .env for production.")

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = jwt_secret

db.init_app(app)
jwt.init_app(app)
limiter.init_app(app)

app.register_blueprint(payments_bp)
app.register_blueprint(parking_spots_bp, url_prefix="/api")

# Interactive Swagger UI, served at /docs, reading the spec from
# static/openapi.yaml. Open http://localhost:5000/docs in a browser.
swaggerui_blueprint = get_swaggerui_blueprint(
    "/docs",
    "/static/openapi.yaml",
    config={"app_name": "Booking & Payments API"},
)
app.register_blueprint(swaggerui_blueprint, url_prefix="/docs")


@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    jti = jwt_payload["jti"]
    return jti in blacklisted_tokens


# ---------------------------------------------------------------------------
# Centralized error handlers — consistent JSON shape without internal leaks
# ---------------------------------------------------------------------------

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Resource not found"}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(429)
def rate_limit_exceeded(e):
    return jsonify({"error": "Too many requests, please slow down"}), 429


@app.errorhandler(500)
def internal_error(e):
    app.logger.exception("Internal server error: %s", e)
    return jsonify({"error": "Internal server error"}), 500


# ---------------------------------------------------------------------------
# Frontend Page & Static Asset Serving
# ---------------------------------------------------------------------------

@app.route("/")
def index_page():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return send_from_directory(FRONTEND_DIR, "index.html")
    return "Hello, World!"


@app.route("/find-parking")
@app.route("/find-parking.html")
def find_parking_page():
    return send_from_directory(FRONTEND_DIR, "find-parking.html")


@app.route("/book-slot")
@app.route("/book-slot.html")
def book_slot_page():
    return send_from_directory(FRONTEND_DIR, "book-slot.html")


@app.route("/my-bookings")
@app.route("/my-bookings.html")
def my_bookings_page():
    return send_from_directory(FRONTEND_DIR, "my-bookings.html")


@app.route("/talk-to-us")
@app.route("/talk-to-us.html")
def talk_to_us_page():
    return send_from_directory(FRONTEND_DIR, "talk-to-us.html")


@app.route("/css/<path:filename>")
def serve_css(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "css"), filename)


@app.route("/js/<path:filename>")
def serve_js(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "js"), filename)


@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "assets"), filename)


@app.route("/signup", methods=["POST"])
@app.route("/api/signup", methods=["POST"])
@limiter.limit("5 per minute")
def signup():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Request body must be JSON"}), 400

        full_name = str(data.get("full_name") or data.get("name") or "").strip()
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        phone_number = str(data.get("phone_number", "")).strip()

        if not full_name:
            return jsonify({"error": "Name is required"}), 400

        if not email:
            return jsonify({"error": "Email is required"}), 400

        try:
            validate_email(email, check_deliverability=False)
        except EmailNotValidError:
            return jsonify({"error": "Invalid email format"}), 400

        if not password or len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400

        # Provide a synthetic phone number if omitted for quick testing
        if not phone_number:
            import hashlib
            phone_suffix = hashlib.md5(email.encode()).hexdigest()[:8]
            phone_number = f"99{int(phone_suffix, 16) % 100000000:08d}"

        existing_user = User.query.filter(
            (User.email == email) | (User.phone_number == phone_number)
        ).first()
        if existing_user:
            return jsonify({"error": "Email or phone number is already registered"}), 409

        new_user = User(
            full_name=full_name,
            email=email,
            phone_number=phone_number,
            password_hash=generate_password_hash(password),
        )
        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            "message": "User created successfully",
            "user": {
                "id": new_user.user_id,
                "user_id": new_user.user_id,
                "name": new_user.full_name,
                "full_name": new_user.full_name,
                "email": new_user.email,
                "phone_number": new_user.phone_number,
            }
        }), 201

    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Email or phone number is already registered"}), 409
    except Exception as e:
        db.session.rollback()
        app.logger.exception("Signup error: %s", e)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/login", methods=["POST"])
@app.route("/api/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Request body must be JSON"}), 400

        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        user = User.query.filter_by(email=email).first()

        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid email or password"}), 401

        access_token = create_access_token(identity=str(user.user_id))

        return jsonify({
            "message": "Login successful",
            "access_token": access_token,
            "user": {
                "id": user.user_id,
                "user_id": user.user_id,
                "name": user.full_name,
                "full_name": user.full_name,
                "email": user.email,
                "phone_number": user.phone_number,
            }
        }), 200

    except Exception as e:
        app.logger.exception("Login error: %s", e)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/profile", methods=["GET"])
@app.route("/api/profile", methods=["GET"])
@jwt_required()
def profile():
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, int(user_id))

        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "id": user.user_id,
            "user_id": user.user_id,
            "name": user.full_name,
            "full_name": user.full_name,
            "email": user.email,
            "phone_number": user.phone_number,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }), 200

    except Exception as e:
        app.logger.exception("Profile error: %s", e)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/logout", methods=["POST"])
@app.route("/api/logout", methods=["POST"])
@jwt_required()
def logout():
    try:
        jti = get_jwt()["jti"]
        blacklisted_tokens.add(jti)
        return jsonify({"message": "Successfully logged out"}), 200
    except Exception as e:
        app.logger.exception("Logout error: %s", e)
        return jsonify({"error": "Internal server error"}), 500


with app.app_context():
    db.create_all()
    try:
        seed_parking_data()
    except Exception as e:
        app.logger.warning("Auto-seed failed or already seeded: %s", e)


if __name__ == "__main__":
    is_debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(debug=is_debug)
