import os
import razorpay

_client = None


def get_razorpay_client():
    """
    Returns a shared Razorpay client instance, built lazily from env vars.
    Lazy init means the app doesn't crash on import if the keys aren't set
    yet (e.g. while running plain auth tests), but WILL crash the moment a
    payment route actually tries to use it without keys configured.
    """
    global _client
    if _client is None:
        key_id = (os.getenv("RAZORPAY_KEY_ID") or "").strip()
        key_secret = (os.getenv("RAZORPAY_KEY_SECRET") or "").strip()
        if not key_id or not key_secret:
            raise RuntimeError(
                "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set in the environment"
            )
        _client = razorpay.Client(auth=(key_id, key_secret))
    return _client
