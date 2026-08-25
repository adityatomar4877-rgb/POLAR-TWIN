from typing import List
from sqlalchemy.orm import Session
from app.models.logistics import LogisticsItem
from app.schemas.logistics import LogisticsForecastOut, LogisticsItemOut
from app.utils.calculations import calculate_days_remaining
from app.core.config import settings


class LogisticsService:
    @staticmethod
    def get_items_by_station(db: Session, station_id: int) -> List[LogisticsItem]:
        items = db.query(LogisticsItem).filter(LogisticsItem.station_id == station_id).all()
        # Update dynamically calculated days remaining and status
        for it in items:
            it.days_remaining = calculate_days_remaining(it.quantity, it.daily_consumption)
            if it.days_remaining < settings.LOGISTICS_CRITICAL_DAYS:
                it.status = "CRITICAL"
            elif it.days_remaining < settings.LOGISTICS_WARNING_DAYS:
                it.status = "WARNING"
            else:
                it.status = "NORMAL"
        db.flush()
        return items

    @staticmethod
    def get_logistics_forecast(db: Session, station_id: int) -> LogisticsForecastOut:
        items = LogisticsService.get_items_by_station(db, station_id)
        critical_count = sum(1 for it in items if it.status == "CRITICAL")
        warning_count = sum(1 for it in items if it.status == "WARNING")

        recommendations: List[str] = []
        for it in items:
            if it.status == "CRITICAL":
                recommendations.append(
                    f"CRITICAL: {it.item_name} has only {it.days_remaining:.1f} days of inventory. Expedite emergency aerial or vessel resupply."
                )
            elif it.status == "WARNING":
                recommendations.append(
                    f"WARNING: {it.item_name} reserve is below 30 days ({it.days_remaining:.1f} days). Schedule restocking during the upcoming logistics window."
                )

        if not recommendations:
            recommendations.append("All logistics inventories are healthy (> 30 days autonomous operational margin).")

        return LogisticsForecastOut(
            station_id=station_id,
            critical_items_count=critical_count,
            warning_items_count=warning_count,
            items=[LogisticsItemOut.model_validate(it) for it in items],
            resupply_recommendations=recommendations,
        )


logistics_service = LogisticsService()
