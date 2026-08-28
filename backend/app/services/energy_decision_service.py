"""
Energy Decision Service — Transparent, Rule-Based Operational Decision Engine.

Interprets:
  1. Current station microgrid energy telemetry (generation, consumption, battery SOC, fuel, grid status)
  2. Environmental / sensor state (storm flag / katabatic winds)
  3. Pre-trained Random Forest energy demand forecasts (6h, 12h, 24h horizons)

Produces:
  - Overall operational energy status (NORMAL, WARNING, HIGH_RISK, CRITICAL)
  - Energy margins against forecast demand
  - Granular, explainable risk reasons
  - Human-readable operational recommendations (decision support only — no physical control)
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.security import APIError
from app.models.energy import EnergyTelemetry
from app.models.sensor import SensorTelemetry
from app.models.station import Station
from app.schemas.energy_decision import (
    EnergyDecisionForecast,
    EnergyDecisionMargin,
    EnergyDecisionResponse,
    EnergyDecisionRisk,
    EnergyDecisionState,
)
from app.services.energy_forecast_service import energy_forecast_service
from app.services.energy_service import energy_service

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────
#  Centralized Configurable Decision Thresholds
# ────────────────────────────────────────────────────────
@dataclass(frozen=True)
class EnergyDecisionConfig:
    """Centralized thresholds for energy decision evaluation."""

    # Battery State of Charge (%)
    BATTERY_HEALTHY_PERCENT: float = 60.0    # >= 60% : healthy
    BATTERY_MODERATE_PERCENT: float = 30.0   # 30% - 59.9% : moderate
    BATTERY_LOW_PERCENT: float = 15.0        # 15% - 29.9% : low
    BATTERY_CRITICAL_PERCENT: float = 15.0   # < 15% : critical

    # Fuel Tank Reserve (%)
    FUEL_HEALTHY_PERCENT: float = 40.0       # >= 40% : healthy
    FUEL_MODERATE_PERCENT: float = 20.0      # 20% - 39.9% : moderate
    FUEL_LOW_PERCENT: float = 10.0           # 10% - 19.9% : low
    FUEL_CRITICAL_PERCENT: float = 10.0      # < 10% : critical

    # Energy Margin Thresholds (kW)
    # Margin = available_generation_kw - predicted_demand_kw
    MARGIN_TIGHT_BUFFER_KW: float = 10.0     # 0 to 10 kW surplus is tight
    MARGIN_DEFICIT_KW: float = 0.0           # < 0 kW is a deficit
    MARGIN_SEVERE_DEFICIT_KW: float = -30.0  # < -30 kW is a severe deficit

    # Storm condition thresholds (if derived from sensor telemetry)
    STORM_WIND_SPEED_KMH: float = 70.0       # Wind speed > 70 km/h
    STORM_VISIBILITY_KM: float = 2.0         # Visibility < 2.0 km


# ────────────────────────────────────────────────────────
#  Energy Decision Service Implementation
# ────────────────────────────────────────────────────────
class EnergyDecisionService:
    """
    Evaluates current station microgrid telemetry and Random Forest demand predictions
    to produce deterministic, explainable decision-support assessments.
    """

    def __init__(self, config: Optional[EnergyDecisionConfig] = None) -> None:
        self.config = config or EnergyDecisionConfig()

    def evaluate_station_energy_decision(
        self,
        db: Session,
        station: Station,
    ) -> EnergyDecisionResponse:
        """
        Main decision pipeline for a given research station:
          1. Retrieve latest energy telemetry from database.
          2. Retrieve latest environmental/sensor telemetry (for storm flag).
          3. Obtain real Random Forest demand predictions (6h, 12h, 24h).
          4. Compute available generation and horizon margins.
          5. Apply rule-based risk evaluation & generate causal reasoning.
          6. Formulate advisory recommendations.
        """
        # 1. Fetch current energy telemetry
        latest_energy: Optional[EnergyTelemetry] = energy_service.get_current_energy(db, station.id)
        if not latest_energy:
            raise APIError(
                code="INSUFFICIENT_TELEMETRY",
                message=f"No energy telemetry recorded for station '{station.code}'.",
                status_code=404,
            )

        # 2. Fetch latest sensor telemetry for storm detection
        latest_sensor: Optional[SensorTelemetry] = (
            db.query(SensorTelemetry)
            .filter(SensorTelemetry.station_id == station.id)
            .order_by(SensorTelemetry.timestamp.desc())
            .first()
        )

        wind_speed = float(latest_sensor.wind_speed) if (latest_sensor and latest_sensor.wind_speed is not None) else 0.0
        visibility = float(latest_sensor.visibility) if (latest_sensor and latest_sensor.visibility is not None) else 10.0
        storm_flag = (wind_speed > self.config.STORM_WIND_SPEED_KMH or visibility < self.config.STORM_VISIBILITY_KM)

        # 3. Obtain real Random Forest energy forecast
        forecast_result = energy_forecast_service.predict(db, station.id, station.code)
        forecast_dict = forecast_result.get("forecast", {})

        pred_6h = float(forecast_dict.get("6h", {}).get("average_consumption_kw", 0.0))
        pred_12h = float(forecast_dict.get("12h", {}).get("average_consumption_kw", 0.0))
        pred_24h = float(forecast_dict.get("24h", {}).get("average_consumption_kw", 0.0))

        # 4. Extract current microgrid parameters
        current_consumption_kw = float(latest_energy.consumption_kw or 0.0)
        solar_gen_kw = float(latest_energy.solar_generation_kw or 0.0)
        diesel_gen_kw = float(latest_energy.diesel_generation_kw or 0.0)

        # Available generation is strictly solar + diesel (batteries are treated as energy reserve, not generation)
        available_generation_kw = round(solar_gen_kw + diesel_gen_kw, 2)

        battery_soc = float(latest_energy.battery_percentage if latest_energy.battery_percentage is not None else 0.0)
        battery_power_kw = float(latest_energy.battery_power_kw or 0.0)
        fuel_level = float(latest_energy.fuel_percentage if latest_energy.fuel_percentage is not None else 0.0)
        grid_status = str(latest_energy.grid_status or "ONLINE").strip()

        # 5. Compute energy margins against predictions
        margin_6h = round(available_generation_kw - pred_6h, 2)
        margin_12h = round(available_generation_kw - pred_12h, 2)
        margin_24h = round(available_generation_kw - pred_24h, 2)

        # 6. Execute rule-based evaluation engine
        risk_level, reasons, recommendations = self._evaluate_rules(
            available_generation_kw=available_generation_kw,
            predicted_6h_demand_kw=pred_6h,
            energy_margin_6h_kw=margin_6h,
            battery_soc=battery_soc,
            fuel_level=fuel_level,
            grid_status=grid_status,
            storm_flag=storm_flag,
            solar_generation_kw=solar_gen_kw,
        )

        now_iso = datetime.now(timezone.utc).isoformat()

        return EnergyDecisionResponse(
            station_id=station.id,
            station_code=station.code,
            generated_at=now_iso,
            status=risk_level,
            forecast=EnergyDecisionForecast(
                h6_average_kw=round(pred_6h, 2),
                h12_average_kw=round(pred_12h, 2),
                h24_average_kw=round(pred_24h, 2),
            ),
            energy_state=EnergyDecisionState(
                current_consumption_kw=round(current_consumption_kw, 2),
                solar_generation_kw=round(solar_gen_kw, 2),
                diesel_generation_kw=round(diesel_gen_kw, 2),
                available_generation_kw=available_generation_kw,
                battery_soc_percent=round(battery_soc, 2),
                battery_power_kw=round(battery_power_kw, 2),
                fuel_level_percent=round(fuel_level, 2),
                grid_status=grid_status,
                storm_flag=storm_flag,
            ),
            energy_margin=EnergyDecisionMargin(
                h6_kw=margin_6h,
                h12_kw=margin_12h,
                h24_kw=margin_24h,
            ),
            risk=EnergyDecisionRisk(
                level=risk_level,
                reasons=reasons,
            ),
            recommendations=recommendations,
        )

    def _evaluate_rules(
        self,
        available_generation_kw: float,
        predicted_6h_demand_kw: float,
        energy_margin_6h_kw: float,
        battery_soc: float,
        fuel_level: float,
        grid_status: str,
        storm_flag: bool,
        solar_generation_kw: float,
    ) -> tuple[str, List[str], List[str]]:
        """
        Transparent rule evaluation engine.
        Returns: (risk_level, reasons_list, recommendations_list)
        """
        reasons: List[str] = []
        recommendations: List[str] = []

        cfg = self.config

        # ─── A. Battery State Assessment ───
        battery_state: str  # "HEALTHY", "MODERATE", "LOW", "CRITICAL"
        if battery_soc < cfg.BATTERY_CRITICAL_PERCENT:
            battery_state = "CRITICAL"
            reasons.append(f"Battery reserve is critically depleted ({battery_soc:.1f}% < {cfg.BATTERY_CRITICAL_PERCENT}%).")
        elif battery_soc < cfg.BATTERY_MODERATE_PERCENT:
            battery_state = "LOW"
            reasons.append(f"Battery reserve is low ({battery_soc:.1f}% < {cfg.BATTERY_MODERATE_PERCENT}%).")
        elif battery_soc < cfg.BATTERY_HEALTHY_PERCENT:
            battery_state = "MODERATE"
            reasons.append(f"Battery reserve is moderate ({battery_soc:.1f}%).")
        else:
            battery_state = "HEALTHY"

        # ─── B. Fuel State Assessment ───
        fuel_state: str  # "HEALTHY", "MODERATE", "LOW", "CRITICAL"
        if fuel_level < cfg.FUEL_CRITICAL_PERCENT:
            fuel_state = "CRITICAL"
            reasons.append(f"Fuel reserve is critically depleted ({fuel_level:.1f}% < {cfg.FUEL_CRITICAL_PERCENT}%).")
        elif fuel_level < cfg.FUEL_MODERATE_PERCENT:
            fuel_state = "LOW"
            reasons.append(f"Fuel reserve is low ({fuel_level:.1f}% < {cfg.FUEL_MODERATE_PERCENT}%).")
        elif fuel_level < cfg.FUEL_HEALTHY_PERCENT:
            fuel_state = "MODERATE"
            reasons.append(f"Fuel reserve is moderate ({fuel_level:.1f}%).")
        else:
            fuel_state = "HEALTHY"

        # ─── C. Generation Margin Assessment ───
        margin_state: str  # "SURPLUS", "TIGHT", "DEFICIT", "SEVERE_DEFICIT"
        if energy_margin_6h_kw < cfg.MARGIN_SEVERE_DEFICIT_KW:
            margin_state = "SEVERE_DEFICIT"
            reasons.append(
                f"Severe energy deficit forecast (-{abs(energy_margin_6h_kw):.1f} kW over 6h; "
                f"forecast demand {predicted_6h_demand_kw:.1f} kW vs available generation {available_generation_kw:.1f} kW)."
            )
        elif energy_margin_6h_kw < cfg.MARGIN_DEFICIT_KW:
            margin_state = "DEFICIT"
            reasons.append(
                f"Forecast demand ({predicted_6h_demand_kw:.1f} kW) exceeds current available generation "
                f"({available_generation_kw:.1f} kW; deficit: {abs(energy_margin_6h_kw):.1f} kW)."
            )
        elif energy_margin_6h_kw < cfg.MARGIN_TIGHT_BUFFER_KW:
            margin_state = "TIGHT"
            reasons.append(
                f"Forecast demand ({predicted_6h_demand_kw:.1f} kW) is approaching available generation capacity "
                f"({available_generation_kw:.1f} kW; margin: +{energy_margin_6h_kw:.1f} kW)."
            )
        else:
            margin_state = "SURPLUS"

        # ─── D. Grid Mode Assessment ───
        is_grid_online = grid_status.upper() == "ONLINE"
        grid_backup_inadequate = False
        if not is_grid_online:
            # Check backup adequacy (generation capacity, battery reserve, fuel reserve)
            if margin_state in ("DEFICIT", "SEVERE_DEFICIT") or battery_state in ("LOW", "CRITICAL") or fuel_state in ("LOW", "CRITICAL"):
                grid_backup_inadequate = True
                reasons.append(f"Grid is offline ({grid_status}) with inadequate backup resources.")
            else:
                reasons.append(f"Grid is offline ({grid_status}), but backup resources remain sufficient.")

        # ─── E. Storm / Environmental Assessment ───
        if storm_flag:
            if solar_generation_kw < 10.0 or margin_state in ("DEFICIT", "SEVERE_DEFICIT") or battery_state in ("LOW", "CRITICAL"):
                reasons.append("Active storm conditions combined with reduced renewable generation and stressed energy reserves.")
            else:
                reasons.append("Active storm conditions detected; heightened renewable generation uncertainty.")

        # ─── F. Synthesize Overall Risk Level ───
        # Criteria:
        # CRITICAL:
        #   - Battery CRITICAL (<15%) OR Fuel CRITICAL (<10%)
        #   - Severe deficit AND (Battery not HEALTHY OR Fuel not HEALTHY OR Storm OR Grid offline)
        #   - Energy deficit AND Battery LOW (<30%) AND Fuel LOW (<20%)
        #   - Storm + Low solar + Low Battery (<30%) + (Deficit or Low Fuel)
        #   - Grid offline + Inadequate backup + (Deficit or Low Battery)
        # HIGH_RISK:
        #   - Energy deficit (margin < 0 kW)
        #   - Severe deficit alone (even with healthy reserves)
        #   - Battery LOW (<30%)
        #   - Fuel LOW (<20%)
        #   - Grid offline with inadequate backup
        #   - Storm + Low battery OR Storm + Deficit
        #   - Multiple moderate concerns (2+ of: moderate battery, moderate fuel, tight margin, grid offline, storm)
        # WARNING:
        #   - Single moderate concern (Tight margin, Moderate battery, Moderate fuel, Grid offline with adequate backup, Storm with adequate reserves)
        # NORMAL:
        #   - Generation sufficient, reserves healthy, grid online, no storm.

        moderate_factors_count = (
            (1 if margin_state == "TIGHT" else 0)
            + (1 if battery_state == "MODERATE" else 0)
            + (1 if fuel_state == "MODERATE" else 0)
            + (1 if (not is_grid_online and not grid_backup_inadequate) else 0)
            + (1 if storm_flag else 0)
        )

        is_critical = (
            battery_state == "CRITICAL"
            or fuel_state == "CRITICAL"
            or (margin_state == "SEVERE_DEFICIT" and (battery_state != "HEALTHY" or fuel_state != "HEALTHY" or storm_flag or not is_grid_online))
            or (margin_state in ("DEFICIT", "SEVERE_DEFICIT") and battery_state == "LOW" and fuel_state == "LOW")
            or (storm_flag and solar_generation_kw < 10.0 and battery_state in ("LOW", "CRITICAL") and (margin_state in ("DEFICIT", "SEVERE_DEFICIT") or fuel_state in ("LOW", "CRITICAL")))
            or (not is_grid_online and grid_backup_inadequate and (margin_state in ("DEFICIT", "SEVERE_DEFICIT") or battery_state in ("LOW", "CRITICAL")))
        )

        is_high_risk = (
            not is_critical
            and (
                margin_state in ("DEFICIT", "SEVERE_DEFICIT")
                or battery_state == "LOW"
                or fuel_state == "LOW"
                or (not is_grid_online and grid_backup_inadequate)
                or (storm_flag and (solar_generation_kw < 10.0 or battery_state in ("LOW", "MODERATE") or margin_state != "SURPLUS"))
                or moderate_factors_count >= 2
            )
        )

        is_warning = (
            not is_critical
            and not is_high_risk
            and (
                margin_state == "TIGHT"
                or battery_state == "MODERATE"
                or fuel_state == "MODERATE"
                or (not is_grid_online and not grid_backup_inadequate)
                or storm_flag
            )
        )

        if is_critical:
            risk_level = "CRITICAL"
        elif is_high_risk:
            risk_level = "HIGH_RISK"
        elif is_warning:
            risk_level = "WARNING"
        else:
            risk_level = "NORMAL"

        # ─── G. Formulate Actionable Recommendations (Advisory Only) ───
        if risk_level == "CRITICAL":
            recommendations.append("Immediate operator attention required.")

        if margin_state in ("DEFICIT", "SEVERE_DEFICIT"):
            recommendations.append("Prepare backup generation.")
            if margin_state == "SEVERE_DEFICIT" or risk_level == "CRITICAL":
                recommendations.append("Prioritize critical loads.")
                recommendations.append("Consider shedding non-critical auxiliary loads.")
        elif margin_state == "TIGHT" and risk_level in ("WARNING", "HIGH_RISK"):
            recommendations.append("Monitor energy generation against forecast demand.")

        if battery_state in ("LOW", "CRITICAL"):
            recommendations.append("Preserve battery reserve.")
            if battery_state == "CRITICAL":
                recommendations.append("Minimize battery discharge by scheduling secondary diesel generation.")
        elif battery_state == "MODERATE" and risk_level in ("WARNING", "HIGH_RISK"):
            recommendations.append("Monitor battery reserve.")

        if fuel_state in ("LOW", "CRITICAL"):
            recommendations.append("Monitor fuel availability.")
            recommendations.append("Assess fuel resupply requirements.")
        elif fuel_state == "MODERATE" and risk_level in ("WARNING", "HIGH_RISK"):
            recommendations.append("Monitor fuel consumption and reserve level.")

        if storm_flag:
            recommendations.append("Monitor weather developments and renewable generation.")

        if not is_grid_online:
            recommendations.append("Maintain microgrid islanding protocols and monitor backup supply.")

        if risk_level == "NORMAL":
            reasons = ["Available generation is sufficient for forecast demand and energy reserves are healthy."]
            recommendations = ["Continue normal energy operations."]

        # Deduplicate recommendations preserving order
        deduped_recommendations: List[str] = []
        seen = set()
        for rec in recommendations:
            if rec not in seen:
                seen.add(rec)
                deduped_recommendations.append(rec)

        return risk_level, reasons, deduped_recommendations


# Module-level singleton
energy_decision_service = EnergyDecisionService()
