from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple


def calculate_energy_balance(generation_kw: float, consumption_kw: float) -> float:
    """Calculates generation - consumption (kW)."""
    return round(float(generation_kw) - float(consumption_kw), 2)


def calculate_days_remaining(quantity: float, daily_consumption: float) -> float:
    """Calculates quantity / daily_consumption safely avoiding division by zero."""
    if daily_consumption <= 0:
        return 999.0  # Infinite/no consumption
    if quantity <= 0:
        return 0.0
    return round(quantity / daily_consumption, 1)


def calculate_equipment_health(
    name: str,
    equipment_type: str,
    temperature: float,
    runtime_hours: float,
    efficiency: float,
    last_maintenance: Optional[datetime] = None,
    nominal_temp: float = 65.0,
    is_faulty: bool = False,
) -> Dict:
    """
    Deterministic baseline scoring algorithm for equipment health.
    Considers temperature, runtime, efficiency, and maintenance age.
    """
    factors: List[str] = []
    recommendation: str = "System operating within optimal parameters."

    # 1. Temperature evaluation
    temp_penalty = 0.0
    if temperature > (nominal_temp + 20.0):
        temp_penalty = 35.0
        factors.append(f"Critical thermal threshold exceeded ({temperature:.1f}°C vs nominal {nominal_temp:.1f}°C)")
    elif temperature > (nominal_temp + 10.0):
        temp_penalty = 20.0
        factors.append(f"Elevated operating temperature ({temperature:.1f}°C)")
    elif temperature > nominal_temp:
        temp_penalty = 8.0
        factors.append(f"Slightly above nominal operating temperature ({temperature:.1f}°C)")

    # 2. Efficiency evaluation
    eff_penalty = 0.0
    if efficiency < 70.0:
        eff_penalty = 30.0
        factors.append(f"Severely degraded operating efficiency ({efficiency:.1f}%)")
    elif efficiency < 85.0:
        eff_penalty = 15.0
        factors.append(f"Suboptimal operating efficiency ({efficiency:.1f}%)")

    # 3. Runtime hours evaluation
    runtime_penalty = 0.0
    if runtime_hours > 6000:
        runtime_penalty = 25.0
        factors.append(f"High cumulative runtime ({runtime_hours:.0f} hrs)")
    elif runtime_hours > 3000:
        runtime_penalty = 10.0
        factors.append(f"Moderate cumulative runtime ({runtime_hours:.0f} hrs)")

    # 4. Maintenance age evaluation
    maint_penalty = 0.0
    if last_maintenance:
        # ensure timezone awareness
        now = datetime.now(timezone.utc)
        if last_maintenance.tzinfo is None:
            last_maint_tz = last_maintenance.replace(tzinfo=timezone.utc)
        else:
            last_maint_tz = last_maintenance
        days_since_maint = (now - last_maint_tz).days
        if days_since_maint > 180:
            maint_penalty = 20.0
            factors.append(f"Routine maintenance overdue ({days_since_maint} days since last service)")
        elif days_since_maint > 120:
            maint_penalty = 10.0
            factors.append(f"Routine maintenance due soon ({days_since_maint} days since last service)")

    # Baseline calculation
    raw_health = 100.0 - (temp_penalty + eff_penalty + runtime_penalty + maint_penalty)
    if is_faulty:
        raw_health = min(raw_health, 25.0)
        factors.append("Mechanical/Electrical trip or anomaly detected")

    health_score = round(max(0.0, min(100.0, raw_health)), 1)

    # Status classification
    if health_score < 30.0:
        status = "CRITICAL"
        recommendation = "Immediate shutdown, inspection, or dispatch backup asset required."
    elif health_score < 60.0:
        status = "WARNING"
        recommendation = "Schedule prioritized maintenance and reduce operational load."
    else:
        status = "NORMAL"
        if factors:
            recommendation = "Monitor system parameters and schedule routine servicing."

    return {
        "equipment": name,
        "equipment_type": equipment_type,
        "health_score": health_score,
        "status": status,
        "factors": factors if factors else ["All monitored telemetry within nominal bounds."],
        "recommendation": recommendation,
    }
