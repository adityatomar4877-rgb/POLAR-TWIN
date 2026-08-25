from datetime import datetime, timezone
from typing import List, Optional
from app.models.logistics import LogisticsItem
from app.utils.calculations import calculate_days_remaining
from app.core.config import settings


class LogisticsSimulator:
    """Simulates realistic daily consumption and inventory attrition for station consumables."""

    @staticmethod
    def update_logistics_item(
        item: LogisticsItem,
        active_scenario: str = "NORMAL_OPERATION",
        dt_seconds: float = 10.0,
    ) -> None:
        fraction_of_day = dt_seconds / 86400.0

        # Adjust burn rate based on scenarios
        consumption_multiplier = 1.0
        if active_scenario == "EXTREME_COLD" and item.category == "FUEL":
            consumption_multiplier = 1.5
        elif active_scenario == "HIGH_ENERGY_DEMAND" and item.category == "FUEL":
            consumption_multiplier = 1.35
        elif active_scenario == "FUEL_SHORTAGE" and item.category == "FUEL":
            # Force low reserve in fuel shortage scenario
            item.quantity = min(item.quantity, item.minimum_threshold * 0.8)

        burn_amount = item.daily_consumption * fraction_of_day * consumption_multiplier
        item.quantity = max(0.0, round(item.quantity - burn_amount, 2))

        item.days_remaining = calculate_days_remaining(item.quantity, item.daily_consumption)

        if item.days_remaining < settings.LOGISTICS_CRITICAL_DAYS:
            item.status = "CRITICAL"
        elif item.days_remaining < settings.LOGISTICS_WARNING_DAYS:
            item.status = "WARNING"
        else:
            item.status = "NORMAL"

        item.updated_at = datetime.now(timezone.utc)
