def test_signup_success(client):
    resp = client.post("/signup", json={
        "name": "Alice",
        "email": "alice@example.com",
        "password": "password1",
    })
    assert resp.status_code == 201
    assert resp.get_json()["user"]["email"] == "alice@example.com"


def test_signup_duplicate_email(client):
    payload = {"name": "Bob", "email": "bob@example.com", "password": "password1"}
    first = client.post("/signup", json=payload)
    second = client.post("/signup", json=payload)
    assert first.status_code == 201
    assert second.status_code == 409


def test_signup_short_password(client):
    resp = client.post("/signup", json={
        "name": "Carl", "email": "carl@example.com", "password": "123",
    })
    assert resp.status_code == 400


def test_signup_invalid_email(client):
    resp = client.post("/signup", json={
        "name": "Dana", "email": "not-an-email", "password": "password1",
    })
    assert resp.status_code == 400


def test_login_wrong_password(client):
    client.post("/signup", json={
        "name": "Eve", "email": "eve@example.com", "password": "password1",
    })
    resp = client.post("/login", json={"email": "eve@example.com", "password": "wrong"})
    assert resp.status_code == 401


def test_profile_requires_auth(client):
    resp = client.get("/profile")
    assert resp.status_code == 401


def test_profile_with_auth(client, auth_headers):
    resp = client.get("/profile", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json()["email"] == "test.user@example.com"


def test_create_booking(client, auth_headers):
    resp = client.post("/bookings", json={
        "item_name": "Yoga class", "amount": 250, "currency": "INR",
    }, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.get_json()["booking"]
    assert body["status"].lower() == "pending"
    assert body["amount"] == 250.0


def test_create_booking_invalid_amount(client, auth_headers):
    resp = client.post("/bookings", json={
        "item_name": "Broken booking", "amount": -10,
    }, headers=auth_headers)
    assert resp.status_code == 400


def test_create_booking_missing_item_name(client, auth_headers):
    resp = client.post("/bookings", json={"amount": 10}, headers=auth_headers)
    assert resp.status_code == 400


def test_list_bookings(client, auth_headers, booking):
    resp = client.get("/bookings", headers=auth_headers)
    assert resp.status_code == 200
    ids = [b["id"] for b in resp.get_json()["bookings"]]
    assert booking["id"] in ids


def test_create_payment_request(client, auth_headers, booking):
    resp = client.post("/payments/create", json={
        "booking_id": booking["id"],
    }, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["order_id"].startswith("order_")
    assert body["key_id"] == "rzp_test_dummy"


def test_create_payment_for_missing_booking(client, auth_headers):
    resp = client.post("/payments/create", json={"booking_id": 999999}, headers=auth_headers)
    assert resp.status_code == 404


def test_create_payment_requires_booking_id(client, auth_headers):
    resp = client.post("/payments/create", json={}, headers=auth_headers)
    assert resp.status_code == 400


def test_verify_payment_wrong_signature(client, auth_headers):
    fresh_booking = client.post("/bookings", json={
        "item_name": "Signature test booking", "amount": 150,
    }, headers=auth_headers).get_json()["booking"]
    create_resp = client.post("/payments/create", json={"booking_id": fresh_booking["id"]}, headers=auth_headers)
    assert create_resp.status_code == 201
    order_id = create_resp.get_json()["order_id"]

    resp = client.post("/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": "pay_fake",
        "razorpay_signature": "not_the_right_one",
    }, headers=auth_headers)
    assert resp.status_code == 400
    assert "error" in resp.get_json()


def test_full_payment_flow_success(client, auth_headers):
    # Create a fresh booking so this test doesn't depend on execution order.
    booking_resp = client.post("/bookings", json={
        "item_name": "Full flow booking", "amount": 100,
    }, headers=auth_headers)
    booking_id = booking_resp.get_json()["booking"]["id"]

    create_resp = client.post("/payments/create", json={"booking_id": booking_id}, headers=auth_headers)
    assert create_resp.status_code == 201
    order_id = create_resp.get_json()["order_id"]

    # Booking can't be paid for twice while pending payment exists.
    second_create = client.post("/payments/create", json={"booking_id": booking_id}, headers=auth_headers)
    assert second_create.status_code == 409

    verify_resp = client.post("/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": "pay_success123",
        "razorpay_signature": "valid_signature",
    }, headers=auth_headers)
    assert verify_resp.status_code == 200
    payment = verify_resp.get_json()["payment"]
    assert payment["status"].lower() in ["paid", "successful"]
    assert payment["booking"]["status"].lower() in ["confirmed"]

    # Verifying again should be a harmless no-op, not an error.
    again = client.post("/payments/verify", json={
        "razorpay_order_id": order_id,
        "razorpay_payment_id": "pay_success123",
        "razorpay_signature": "valid_signature",
    }, headers=auth_headers)
    assert again.status_code == 200


def test_payment_history(client, auth_headers):
    resp = client.get("/payments/history?page=1&per_page=5", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.get_json()
    assert "payments" in body
    assert body["page"] == 1
    assert body["per_page"] == 5


def test_payment_history_requires_auth(client):
    resp = client.get("/payments/history")
    assert resp.status_code == 401


def test_logout_flow(client):
    client.post("/signup", json={
        "name": "Logout User",
        "email": "logout.user@example.com",
        "password": "password123",
    })
    login_resp = client.post("/login", json={
        "email": "logout.user@example.com",
        "password": "password123",
    })
    token = login_resp.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Profile works with active token
    assert client.get("/profile", headers=headers).status_code == 200

    # Logout
    logout_resp = client.post("/logout", headers=headers)
    assert logout_resp.status_code == 200

    # Same token is now rejected
    assert client.get("/profile", headers=headers).status_code == 401


def test_get_parking_spots(client):
    resp = client.get("/api/parking-spots")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert isinstance(data["data"], list)
    if len(data["data"]) > 0:
        first = data["data"][0]
        assert "id" in first
        assert "name" in first
        assert "hourlyRate" in first
        assert "floors" in first


def test_get_nearby_spots(client):
    resp = client.get("/api/parking-spots/nearby?lat=18.5204&lng=73.8415&vehicleType=car")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["success"] is True
    assert "userLocation" in data
    assert isinstance(data["data"], list)
    if len(data["data"]) > 1:
        # Verify sorted by distance
        dists = [s["distanceKm"] for s in data["data"]]
        assert dists == sorted(dists)


def test_get_spot_details(client):
    list_resp = client.get("/api/parking-spots")
    spots = list_resp.get_json()["data"]
    if spots:
        spot_id = spots[0]["id"]
        detail_resp = client.get(f"/api/parking-spots/{spot_id}")
        assert detail_resp.status_code == 200
        spot_data = detail_resp.get_json()["data"]
        assert spot_data["id"] == spot_id
        assert len(spot_data["floors"]) > 0


def test_get_platform_stats(client):
    resp = client.get("/api/stats")
    assert resp.status_code == 200
    stats = resp.get_json()
    assert stats["success"] is True
    assert "data" in stats
    assert stats["data"]["totalSlotsNetwork"] > 0
    assert stats["data"]["activeCities"] > 0


def test_submit_contact_inquiry(client):
    # Missing required fields
    bad_resp = client.post("/api/contact", json={"name": ""})
    assert bad_resp.status_code == 400

    # Valid submission
    resp = client.post("/api/contact", json={
        "name": "Host Partner",
        "email": "partner@example.com",
        "phone": "+91 9876543210",
        "message": "I have 50 parking slots available in Pune."
    })
    assert resp.status_code == 200
    assert resp.get_json()["success"] is True

