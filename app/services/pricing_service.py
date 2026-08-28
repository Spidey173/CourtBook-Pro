"""Authoritative Server-Side Pricing Engine."""
from datetime import date
from typing import Dict, List, Tuple, Any, Optional
from app.models.court import Court
from app.models.coach import Coach
from app.models.equipment import Equipment
from app.models.pricing_rule import PricingRule


class PricingService:
    """Computes authoritative booking prices and itemized breakdowns."""

    @staticmethod
    def is_peak_hour(time_slot: str, booking_date: date, rule: PricingRule) -> bool:
        """Check if time slot and date fall into peak hours rule."""
        if not rule or not rule.enabled or not rule.start_time or not rule.end_time:
            return False

        # Check day filter if specified e.g. "1,2,3,4,5" (Mon=1 ... Sun=7)
        if rule.apply_days:
            allowed_days = [int(d.strip()) for d in rule.apply_days.split(',') if d.strip().isdigit()]
            # Python date.isoweekday(): 1=Monday, 7=Sunday
            if booking_date.isoweekday() not in allowed_days:
                return False

        # Compare time strings "18:00" <= time_slot < "21:00"
        return rule.start_time <= time_slot < rule.end_time

    @staticmethod
    def is_weekend(booking_date: date, rule: PricingRule) -> bool:
        """Check if date is weekend (Saturday or Sunday)."""
        if not rule or not rule.enabled:
            return False
        # 6=Saturday, 7=Sunday
        return booking_date.isoweekday() in (6, 7)

    @classmethod
    def calculate_price(
        cls,
        court: Court,
        booking_date: date,
        time_slot: str,
        duration: int = 1,
        coach: Optional[Coach] = None,
        equipment_requests: Optional[Dict[int, int]] = None
    ) -> Dict[str, Any]:
        """
        Calculates the definitive total price and breakdown for a reservation.
        """
        equipment_requests = equipment_requests or {}
        breakdown: List[Dict[str, Any]] = []
        applied_rules: List[str] = []

        # 1. Fetch active pricing rules from database
        rules = {r.rule_type: r for r in PricingRule.query.filter_by(enabled=True).all()}

        # 2. Base Court Price & Multipliers
        court_base = court.base_price
        breakdown.append({
            'label': f"{court.name} (Base)",
            'value': court_base,
            'type': 'base'
        })

        court_multiplier = 1.0

        # Peak hours
        peak_rule = rules.get('peak_hours')
        if peak_rule and cls.is_peak_hour(time_slot, booking_date, peak_rule):
            court_multiplier *= peak_rule.multiplier
            applied_rules.append(f"Peak Hours (x{peak_rule.multiplier})")

        # Weekend
        weekend_rule = rules.get('weekend')
        if weekend_rule and cls.is_weekend(booking_date, weekend_rule):
            court_multiplier *= weekend_rule.multiplier
            applied_rules.append(f"Weekend (x{weekend_rule.multiplier})")

        # Indoor court premium
        indoor_rule = rules.get('indoor')
        if indoor_rule and court.type.lower() == 'indoor':
            court_multiplier *= indoor_rule.multiplier
            applied_rules.append(f"Indoor Court (x{indoor_rule.multiplier})")

        adjusted_court_price = round(court_base * court_multiplier)
        if court_multiplier != 1.0:
            breakdown.append({
                'label': f"Court Multipliers (x{court_multiplier:.2f})",
                'value': adjusted_court_price - court_base,
                'type': 'multiplier'
            })

        breakdown.append({
            'label': 'Court Subtotal (per hr)',
            'value': adjusted_court_price,
            'type': 'subtotal'
        })

        # 3. Equipment Calculation & Bundle Discount
        equipment_subtotal = 0
        total_equipment_items = 0
        equipment_line_items = []

        if equipment_requests:
            equip_ids = [int(eid) for eid, qty in equipment_requests.items() if qty > 0]
            if equip_ids:
                db_equipments = {e.id: e for e in Equipment.query.filter(Equipment.id.in_(equip_ids)).all()}
                for eq_id, qty in equipment_requests.items():
                    if qty <= 0:
                        continue
                    eq_obj = db_equipments.get(int(eq_id))
                    if eq_obj:
                        line_cost = eq_obj.price * qty
                        equipment_subtotal += line_cost
                        total_equipment_items += qty
                        equipment_line_items.append({
                            'label': f"{eq_obj.name} ({qty}x)",
                            'value': line_cost,
                            'type': 'equipment'
                        })

        breakdown.extend(equipment_line_items)

        # Bundle discount
        bundle_rule = rules.get('bundle')
        final_equipment_total = equipment_subtotal
        if bundle_rule and total_equipment_items >= (bundle_rule.min_items or 3) and equipment_subtotal > 0:
            bundle_discount_amount = round(equipment_subtotal * bundle_rule.discount)
            final_equipment_total = equipment_subtotal - bundle_discount_amount
            applied_rules.append(f"Equipment Bundle (-{int(bundle_rule.discount * 100)}%)")
            breakdown.append({
                'label': f"Equipment Bundle Discount ({int(bundle_rule.discount * 100)}%)",
                'value': -bundle_discount_amount,
                'type': 'discount'
            })

        if equipment_line_items:
            breakdown.append({
                'label': 'Equipment Subtotal',
                'value': final_equipment_total,
                'type': 'subtotal'
            })

        # 4. Coach Fee
        coach_fee = 0
        if coach:
            coach_fee = coach.price
            breakdown.append({
                'label': f"Coach: {coach.name}",
                'value': coach_fee,
                'type': 'coach'
            })

        # 5. Hourly Combined Subtotal
        hourly_total = adjusted_court_price + final_equipment_total + coach_fee
        total_before_duration_discount = hourly_total * duration

        if duration > 1:
            breakdown.append({
                'label': f"Duration Multiplier ({duration} hours)",
                'value': total_before_duration_discount,
                'type': 'duration'
            })

        # 6. Multi-Hour Discount
        final_total = total_before_duration_discount
        multi_hour_rule = rules.get('multiple_hours')
        if multi_hour_rule and duration > 1:
            discount_rate = min(0.5, (duration - 1) * multi_hour_rule.discount)
            discount_amount = round(total_before_duration_discount * discount_rate)
            final_total = max(0, total_before_duration_discount - discount_amount)
            applied_rules.append(f"Multi-Hour Discount (-{int(discount_rate * 100)}%)")
            breakdown.append({
                'label': f"Multi-Hour Discount ({int(discount_rate * 100)}%)",
                'value': -discount_amount,
                'type': 'discount'
            })

        breakdown.append({
            'label': 'Final Total',
            'value': final_total,
            'type': 'total'
        })

        return {
            'total_price': final_total,
            'totalPrice': final_total,
            'breakdown': breakdown,
            'applied_rules': applied_rules
        }
