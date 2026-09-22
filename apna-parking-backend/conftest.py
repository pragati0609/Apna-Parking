"""
Test setup.

We don't hit a real MySQL database or the real Razorpay API in tests:
- DATABASE_URL is pointed at a throwaway SQLite file for the test run.
- The Razorpay client is replaced with a small fake so tests are fast,
  free, and don't need real API keys or network access.
"""
import os
import sys
import tempfile
import uuid

import pytest

# --- Point the app at a throwaway SQLite DB and dummy secrets BEFORE
#     importing the app module, since app.py reads env vars at import time.
_db_fd, _db_path = tempfile.mkstemp(suffix=".sqlite3")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-at-least-32-chars-long-for-jwt-sha256"
os.environ["RAZORPAY_KEY_ID"] = "rzp_test_dummy"
os.environ["RAZORPAY_KEY_SECRET"] = "dummy_secret"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as app_module  # noqa: E402
import payments as payments_module  # noqa: E402
import razorpay  # noqa: E402


class FakeOrderApi:
    def create(self, data):
        return {"id": f"order_{uuid.uuid4().hex[:12]}", "amount": data["amount"], "currency": data["currency"]}


class FakeUtilityApi:
    """
    verify_payment_signature raises razorpay.errors.SignatureVerificationError
    on bad input, like the real SDK does. We treat the signature string
    "valid_signature" as the "correct" one for test purposes.
    """
    def verify_payment_signature(self, params):
        if params.get("razorpay_signature") != "valid_signature":
            raise razorpay.errors.SignatureVerificationError("Signature verification failed")
        return True


class FakeRazorpayClient:
    def __init__(self):
        self.order = FakeOrderApi()
        self.utility = FakeUtilityApi()


@pytest.fixture(scope="session", autouse=True)
def _patch_razorpay():
    fake_client = FakeRazorpayClient()
    payments_module.get_razorpay_client = lambda: fake_client
    yield


@pytest.fixture(scope="session")
def app():
    flask_app = app_module.app
    flask_app.config.update(TESTING=True)
    app_module.limiter.enabled = False
    with flask_app.app_context():
        app_module.db.create_all()
    yield flask_app
    with flask_app.app_context():
        app_module.db.session.remove()
        app_module.db.engine.dispose()
    try:
        os.close(_db_fd)
    except OSError:
        pass
    try:
        os.remove(_db_path)
    except OSError:
        pass


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()


@pytest.fixture(scope="module")
def auth_headers(client):
    """Sign up + log in one throwaway user, return an Authorization header dict."""
    client.post("/signup", json={
        "name": "Test User",
        "email": "test.user@example.com",
        "password": "secret123",
    })
    resp = client.post("/login", json={
        "email": "test.user@example.com",
        "password": "secret123",
    })
    token = resp.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def booking(client, auth_headers):
    resp = client.post("/bookings", json={
        "item_name": "Conference Room A - 2 hours",
        "amount": 499.00,
        "currency": "INR",
    }, headers=auth_headers)
    return resp.get_json()["booking"]
