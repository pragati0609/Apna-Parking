from decimal import Decimal
from extensions import db
from models import Location, ParkingSpace

SAMPLE_SPOTS = [
    {
        "name": "City Center Parking",
        "address": "FC Road, Deccan Gymkhana, Pune, Maharashtra 411004",
        "city": "Pune",
        "state": "Maharashtra",
        "postal_code": "411004",
        "lat": 18.5204,
        "lng": 73.8415,
        "hourly_rate": Decimal("40.00"),
        "daily_rate": Decimal("350.00"),
        "monthly_rate": Decimal("2499.00"),
        "rating": 4.5,
        "reviews_count": 120,
        "category": "Commercial Mall & Plaza",
        "vehicle_types": "car,bike,ev,truck",
        "amenities": "CCTV Surveillance,24/7 Security Guard,Covered Basement,24/7 Access,EV Fast Charging,Valet Parking,Car Wash on Request,Wheelchair Accessible",
        "operating_hours": "24 Hours Open",
        "description": "Spacious and secure multi-level underground parking at the heart of FC Road. 24/7 access with high-definition CCTV surveillance, smart license plate recognition, and EV charging stations.",
        "floors": [
            {"floor": "B1", "count": 24, "rate": Decimal("40.00"), "ev_count": 6},
            {"floor": "B2", "count": 24, "rate": Decimal("40.00"), "ev_count": 4},
            {"floor": "B3", "count": 24, "rate": Decimal("35.00"), "ev_count": 2},
        ],
    },
    {
        "name": "Phoenix Marketcity Parking",
        "address": "Viman Nagar, Nagar Road, Pune, Maharashtra 411014",
        "city": "Pune",
        "state": "Maharashtra",
        "postal_code": "411014",
        "lat": 18.5621,
        "lng": 73.9168,
        "hourly_rate": Decimal("50.00"),
        "daily_rate": Decimal("450.00"),
        "monthly_rate": Decimal("2999.00"),
        "rating": 4.3,
        "reviews_count": 98,
        "category": "Shopping Mall Complex",
        "vehicle_types": "car,bike,ev",
        "amenities": "Underground Sheltered,Ticketless FASTag Entry,EV Supercharger,Disabled Access,Restrooms",
        "operating_hours": "9:00 AM - 12:00 AM",
        "description": "Premium commercial parking with dedicated EV charging bays and automated FASTag boom barrier gate controls.",
        "floors": [
            {"floor": "B1", "count": 20, "rate": Decimal("50.00"), "ev_count": 5},
            {"floor": "B2", "count": 20, "rate": Decimal("50.00"), "ev_count": 3},
        ],
    },
    {
        "name": "Amanora Mall Mega Parking",
        "address": "Amanora Park Town, Hadapsar, Pune, Maharashtra 411028",
        "city": "Pune",
        "state": "Maharashtra",
        "postal_code": "411028",
        "lat": 18.5178,
        "lng": 73.9352,
        "hourly_rate": Decimal("45.00"),
        "daily_rate": Decimal("400.00"),
        "monthly_rate": Decimal("2700.00"),
        "rating": 4.6,
        "reviews_count": 140,
        "category": "Mall & Leisure Center",
        "vehicle_types": "car,bike,ev,truck",
        "amenities": "Multi-Level Access,Automated Boom Barriers,24/7 Security Patrol,EV Charging",
        "operating_hours": "24 Hours Open",
        "description": "Massive multi-level parking facility connected right beside the central plaza. Quick ingress and egress.",
        "floors": [
            {"floor": "B1", "count": 20, "rate": Decimal("45.00"), "ev_count": 4},
            {"floor": "B2", "count": 20, "rate": Decimal("45.00"), "ev_count": 4},
        ],
    },
    {
        "name": "Deccan Gymkhana Smart Bay",
        "address": "Prabhat Road, Lane 4, Deccan Gymkhana, Pune 411004",
        "city": "Pune",
        "state": "Maharashtra",
        "postal_code": "411004",
        "lat": 18.5165,
        "lng": 73.8375,
        "hourly_rate": Decimal("35.00"),
        "daily_rate": Decimal("280.00"),
        "monthly_rate": Decimal("1999.00"),
        "rating": 4.7,
        "reviews_count": 75,
        "category": "Community & Transit Bay",
        "vehicle_types": "car,bike",
        "amenities": "CCTV,Guarded Entry,Shaded Rooftop,Digital Payments Only",
        "operating_hours": "6:00 AM - 11:30 PM",
        "description": "Peaceful shaded surface lot with smart slot reservations.",
        "floors": [
            {"floor": "B1", "count": 15, "rate": Decimal("35.00"), "ev_count": 0},
        ],
    },
    {
        "name": "Koregaon Park Plaza Parking",
        "address": "North Main Road, Koregaon Park, Pune 411001",
        "city": "Pune",
        "state": "Maharashtra",
        "postal_code": "411001",
        "lat": 18.5362,
        "lng": 73.8942,
        "hourly_rate": Decimal("60.00"),
        "daily_rate": Decimal("500.00"),
        "monthly_rate": Decimal("3500.00"),
        "rating": 4.8,
        "reviews_count": 210,
        "category": "Corporate & High Street",
        "vehicle_types": "car,bike,ev",
        "amenities": "Valet Assist,Luxury Vehicle Friendly,Rapid DC Chargers,Full Camera Coverage",
        "operating_hours": "24 Hours Open",
        "description": "Upscale covered facility tailored for luxury cars and high street restaurant visitors.",
        "floors": [
            {"floor": "B1", "count": 18, "rate": Decimal("60.00"), "ev_count": 6},
            {"floor": "B2", "count": 18, "rate": Decimal("60.00"), "ev_count": 4},
        ],
    },
    {
        "name": "Shivaji Nagar Multilevel Parking",
        "address": "Near Shivaji Nagar Railway Station, Pune 411005",
        "city": "Pune",
        "state": "Maharashtra",
        "postal_code": "411005",
        "lat": 18.5314,
        "lng": 73.8553,
        "hourly_rate": Decimal("30.00"),
        "daily_rate": Decimal("220.00"),
        "monthly_rate": Decimal("1600.00"),
        "rating": 4.2,
        "reviews_count": 310,
        "category": "Public Transit & Commuter",
        "vehicle_types": "car,bike,truck",
        "amenities": "Transit Link,24/7 Guards,Park & Ride Passes,Overnight Discount",
        "operating_hours": "24 Hours Open",
        "description": "Ideal Park-and-Ride hub directly opposite the metro station and railway transit junction.",
        "floors": [
            {"floor": "B1", "count": 20, "rate": Decimal("30.00"), "ev_count": 2},
            {"floor": "B2", "count": 20, "rate": Decimal("30.00"), "ev_count": 2},
        ],
    },
]


from sqlalchemy import inspect, text


def sync_database_schema():
    """Ensure newly added columns exist in existing database tables (e.g. MySQL)."""
    try:
        inspector = inspect(db.engine)
        table_map = {t.lower(): t for t in inspector.get_table_names()}

        with db.engine.connect() as conn:
            loc_table = table_map.get("locations")
            if loc_table:
                loc_cols = [c["name"].lower() for c in inspector.get_columns(loc_table)]
                new_loc_columns = [
                    ("latitude", "FLOAT NULL"),
                    ("longitude", "FLOAT NULL"),
                    ("daily_rate", "DECIMAL(10,2) DEFAULT 350.00"),
                    ("monthly_rate", "DECIMAL(10,2) DEFAULT 2499.00"),
                    ("rating", "FLOAT DEFAULT 4.5"),
                    ("reviews_count", "INT DEFAULT 50"),
                    ("category", "VARCHAR(100) DEFAULT 'Commercial Mall & Plaza'"),
                    ("image", "VARCHAR(255) DEFAULT '/assets/images/garage_preview.jpg'"),
                    ("banner_image", "VARCHAR(500) DEFAULT 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80'"),
                    ("description", "TEXT NULL"),
                    ("vehicle_types", "VARCHAR(100) DEFAULT 'car,bike,ev,truck'"),
                    ("amenities", "TEXT NULL"),
                    ("operating_hours", "VARCHAR(50) DEFAULT '24 Hours Open'"),
                ]
                for col_name, col_type in new_loc_columns:
                    if col_name.lower() not in loc_cols:
                        conn.execute(text(f"ALTER TABLE `{loc_table}` ADD COLUMN `{col_name}` {col_type}"))
                conn.commit()

            space_table = table_map.get("parkingspaces")
            if space_table:
                space_cols = [c["name"].lower() for c in inspector.get_columns(space_table)]
                new_space_columns = [
                    ("floor", "VARCHAR(20) DEFAULT 'B1'"),
                    ("rate", "DECIMAL(10,2) NULL"),
                ]
                for col_name, col_type in new_space_columns:
                    if col_name.lower() not in space_cols:
                        conn.execute(text(f"ALTER TABLE `{space_table}` ADD COLUMN `{col_name}` {col_type}"))
                conn.commit()
    except Exception as e:
        print(f"Schema sync notice: {e}")


def seed_parking_data():
    """Seed initial Pune locations and multi-floor slot layouts if not present."""
    sync_database_schema()
    if Location.query.filter(Location.latitude.isnot(None)).count() > 0:
        return

    for spot_data in SAMPLE_SPOTS:
        loc = Location.query.filter_by(location_name=spot_data["name"]).first()
        if not loc:
            loc = Location(
                location_name=spot_data["name"],
                address=spot_data["address"],
                city=spot_data["city"],
                state=spot_data["state"],
                postal_code=spot_data["postal_code"],
                hourly_rate=spot_data["hourly_rate"],
                latitude=spot_data["lat"],
                longitude=spot_data["lng"],
                daily_rate=spot_data["daily_rate"],
                monthly_rate=spot_data["monthly_rate"],
                rating=spot_data["rating"],
                reviews_count=spot_data["reviews_count"],
                category=spot_data["category"],
                vehicle_types=spot_data["vehicle_types"],
                amenities=spot_data["amenities"],
                operating_hours=spot_data["operating_hours"],
                description=spot_data["description"],
            )
            db.session.add(loc)
            db.session.flush()

            # Seed slots across floors
            for fl_info in spot_data.get("floors", []):
                floor_code = fl_info["floor"]
                count = fl_info["count"]
                rate = fl_info["rate"]
                ev_count = fl_info.get("ev_count", 0)

                for i in range(1, count + 1):
                    slot_num_str = f"{i:02d}"
                    is_ev = (i <= ev_count)
                    if is_ev:
                        space_type = "EV_Charging"
                        slot_rate = rate + Decimal("20.00")
                    elif i % 4 == 0:
                        space_type = "Compact"  # bikes
                        slot_rate = Decimal(str(round(float(rate) * 0.4, 2)))
                    else:
                        space_type = "Standard"
                        slot_rate = rate

                    space = ParkingSpace(
                        location_id=loc.location_id,
                        space_number=f"{floor_code}-{slot_num_str}",
                        space_type=space_type,
                        floor=floor_code,
                        rate=slot_rate,
                        is_active=True,
                    )
                    db.session.add(space)

    db.session.commit()
