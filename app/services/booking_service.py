"""Atomic Booking Management Service."""
import logging
from datetime import date
from typing import Dict, Any, Optional, List
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models.user import User
from app.models.court import Court
from app.models.coach import Coach
from app.models.equipment import Equipment
from app.models.booking import Booking, BookingSlot, BookingEquipment, BookingStatus
from app.services.pricing_service import PricingService
from app.services.availability_service import AvailabilityService

logger = logging.getLogger(__name__)


class BookingConflictError(Exception):
    """Raised when a requested resource (court, coach, or equipment) is unavailable."""
    pass


class BookingNotFoundError(Exception):
    """Raised when a requested booking record does not exist."""
    pass


class BookingService:
    """Orchestrates atomic reservation creation, validation, cancellation, and retrieval."""

    @classmethod
    def create_booking(
        cls,
        user_id: int,
        court_id: int,
        booking_date: date,
        time_slot: str,
        duration: int = 1,
        coach_id: Optional[int] = None,
        equipment_requests: Optional[Dict[str, int]] = None
    ) -> Dict[str, Any]:
        """
        Atomically creates a new court reservation with multi-resource validation,
        physical slot locking, and authoritative server-side price calculation.
        """
        equipment_requests = equipment_requests or {}
        # Normalize equipment dictionary keys to int
        cleaned_equip: Dict[int, int] = {}
        for k, v in equipment_requests.items():
            try:
                k_int, v_int = int(k), int(v)
                if v_int > 0:
                    cleaned_equip[k_int] = v_int
            except (ValueError, TypeError):
                continue

        # 1. Fetch Court
        court = Court.query.filter_by(id=court_id, is_active=True).first()
        if not court:
            raise ValueError(f"Court #{court_id} does not exist or is currently inactive.")

        # 2. Fetch Coach (if requested)
        coach = None
        if coach_id:
            coach = Coach.query.filter_by(id=coach_id, is_active=True).first()
            if not coach:
                raise ValueError(f"Coach #{coach_id} does not exist or is currently inactive.")

        # 3. Check Court Availability across all duration slots
        consecutive_slots = AvailabilityService.get_slots_for_duration(time_slot, duration)
        if len(consecutive_slots) < duration:
            raise ValueError(f"Cannot book {duration} hours starting at {time_slot} (exceeds operating hours).")

        if not AvailabilityService.is_court_available(court_id, booking_date, time_slot, duration):
            raise BookingConflictError(f"{court.name} is already booked for the selected time slot(s).")

        # 4. Check Coach Availability
        if coach and not AvailabilityService.is_coach_available(coach_id, booking_date, time_slot, duration):
            raise BookingConflictError(f"{coach.name} is already reserved for the selected time slot(s).")

        # 5. Check Equipment Availability
        if cleaned_equip:
            eq_avail_map = AvailabilityService.get_equipment_availability(booking_date, consecutive_slots)
            for eq_id, requested_qty in cleaned_equip.items():
                available_qty = eq_avail_map.get(eq_id, 0)
                if requested_qty > available_qty:
                    eq_obj = db.session.get(Equipment, eq_id)
                    eq_name = eq_obj.name if eq_obj else f"Item #{eq_id}"
                    raise BookingConflictError(
                        f"Insufficient stock for {eq_name}. Requested: {requested_qty}, Available: {available_qty}"
                    )

        # 6. Authoritative Pricing Calculation
        price_result = PricingService.calculate_price(
            court=court,
            booking_date=booking_date,
            time_slot=time_slot,
            duration=duration,
            coach=coach,
            equipment_requests=cleaned_equip
        )
        total_price = price_result['total_price']

        # 7. Atomic Database Insertion with Slot Locks
        try:
            booking = Booking(
                user_id=user_id,
                court_id=court_id,
                coach_id=coach_id,
                date=booking_date,
                time_slot=time_slot,
                duration=duration,
                total_price=total_price,
                status=BookingStatus.CONFIRMED.value
            )
            db.session.add(booking)
            db.session.flush()  # Flush to acquire booking.id

            # Insert physical slot locks for each consecutive hour
            for slot in consecutive_slots:
                booking_slot = BookingSlot(
                    booking_id=booking.id,
                    court_id=court_id,
                    coach_id=coach_id,
                    date=booking_date,
                    time_slot=slot
                )
                db.session.add(booking_slot)

            # Insert equipment line items
            for eq_id, qty in cleaned_equip.items():
                equip_item = BookingEquipment(
                    booking_id=booking.id,
                    equipment_id=eq_id,
                    quantity=qty
                )
                db.session.add(equip_item)

            db.session.commit()
            logger.info("Created Booking #%s for User #%s (Total: %s)", booking.id, user_id, total_price)

            return {
                'booking_id': booking.id,
                'total_price': total_price,
                'totalPrice': total_price,
                'breakdown': price_result['breakdown'],
                'applied_rules': price_result['applied_rules'],
                'booking': booking.to_dict()
            }

        except IntegrityError as ie:
            db.session.rollback()
            logger.warning("Integrity error on booking creation: %s", ie)
            raise BookingConflictError("The court or coach was just booked by another user. Please choose another time slot.")
        except Exception as e:
            db.session.rollback()
            logger.exception("Unexpected error creating booking: %s", e)
            raise e

    @classmethod
    def cancel_booking(cls, booking_id: int, user_id: Optional[int] = None, is_admin: bool = False) -> Booking:
        """
        Cancels an active booking and immediately releases physical slot locks.
        """
        booking = db.session.get(Booking, booking_id)
        if not booking:
            raise BookingNotFoundError(f"Booking #{booking_id} does not exist.")

        if not is_admin and booking.user_id != user_id:
            raise PermissionError("You do not have permission to cancel this booking.")

        if booking.status == BookingStatus.CANCELLED.value:
            raise ValueError("This booking is already cancelled.")

        # Update status and delete physical slot locks to free up availability
        booking.status = BookingStatus.CANCELLED.value
        BookingSlot.query.filter_by(booking_id=booking.id).delete()

        db.session.commit()
        logger.info("Cancelled Booking #%s by User #%s (Admin: %s)", booking_id, user_id, is_admin)
        return booking
