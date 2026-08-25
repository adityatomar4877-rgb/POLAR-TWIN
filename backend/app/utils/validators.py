from typing import Any
from app.core.security import APIError


def validate_percentage(value: float, field_name: str = "percentage") -> float:
    """Ensures value is strictly between 0 and 100 inclusive."""
    val = float(value)
    if val < 0.0 or val > 100.0:
        raise APIError(
            code="INVALID_PERCENTAGE",
            message=f"{field_name} must be between 0.0 and 100.0 (received {val})",
            status_code=422,
        )
    return val


def validate_non_negative(value: float, field_name: str = "value") -> float:
    """Ensures a physical metric (e.g. generation, consumption, quantity) is non-negative."""
    val = float(value)
    if val < 0.0:
        raise APIError(
            code="INVALID_NON_NEGATIVE",
            message=f"{field_name} cannot be negative (received {val})",
            status_code=422,
        )
    return val


def clamp_percentage(value: float) -> float:
    """Safely clamps a float to 0.0 - 100.0 without throwing."""
    return max(0.0, min(100.0, round(float(value), 2)))
