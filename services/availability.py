# services/availability.py
from models import db, Court, Coach, Equipment, Booking, BookingEquipment
from datetime import date
from sqlalchemy import func

def is_court_available(court_id, booking_date, time_slot, duration=1, exclude_booking_id=None):
    """Check if a court is free at the given date and consecutive time slots."""
    query = Booking.query.filter(
        Booking.court_id == court_id,
        Booking.date == booking_date,
        Booking.status.in_(['pending', 'confirmed'])
    )
    if exclude_booking_id:
        query = query.filter(Booking.id != exclude_booking_id)
        
    existing_bookings = query.all()
    
    time_slots = [
        '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
        '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
        '18:00', '19:00', '20:00', '21:00'
    ]
    
    try:
        start_idx = time_slots.index(time_slot)
    except ValueError:
        return False
        
    requested_slots = set(time_slots[start_idx : start_idx + duration])
    if len(requested_slots) < duration:
        return False
        
    for booking in existing_bookings:
        try:
            b_start_idx = time_slots.index(booking.time_slot)
        except ValueError:
            continue
        b_duration = booking.duration or 1
        b_slots = set(time_slots[b_start_idx : b_start_idx + b_duration])
        if requested_slots.intersection(b_slots):
            return False
            
    return True

def is_coach_available(coach_id, booking_date, time_slot, duration=1, exclude_booking_id=None):
    """Check if a coach is free at the given date and consecutive time slots."""
    if coach_id is None:
        return True
        
    query = Booking.query.filter(
        Booking.coach_id == coach_id,
        Booking.date == booking_date,
        Booking.status.in_(['pending', 'confirmed'])
    )
    if exclude_booking_id:
        query = query.filter(Booking.id != exclude_booking_id)
        
    existing_bookings = query.all()
    
    time_slots = [
        '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
        '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
        '18:00', '19:00', '20:00', '21:00'
    ]
    
    try:
        start_idx = time_slots.index(time_slot)
    except ValueError:
        return False
        
    requested_slots = set(time_slots[start_idx : start_idx + duration])
    if len(requested_slots) < duration:
        return False
        
    for booking in existing_bookings:
        try:
            b_start_idx = time_slots.index(booking.time_slot)
        except ValueError:
            continue
        b_duration = booking.duration or 1
        b_slots = set(time_slots[b_start_idx : b_start_idx + b_duration])
        if requested_slots.intersection(b_slots):
            return False
            
    return True

def is_equipment_available(equipment_requests, booking_date, time_slot, duration=1):
    """
    equipment_requests = {equipment_id: requested_quantity, ...}
    Returns True if every equipment item has enough available units for all slots in the duration.
    """
    time_slots = [
        '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
        '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
        '18:00', '19:00', '20:00', '21:00'
    ]
    
    try:
        start_idx = time_slots.index(time_slot)
    except ValueError:
        return False
        
    requested_slots = time_slots[start_idx : start_idx + duration]
    if len(requested_slots) < duration:
        return False
        
    for equip_id, req_qty in equipment_requests.items():
        if req_qty <= 0:
            continue
        equip = Equipment.query.get(equip_id)
        if not equip:
            return False
            
        for slot in requested_slots:
            active_bookings = Booking.query.filter(
                Booking.date == booking_date,
                Booking.status.in_(['pending', 'confirmed'])
            ).all()
            
            total_booked = 0
            for booking in active_bookings:
                try:
                    b_start_idx = time_slots.index(booking.time_slot)
                except ValueError:
                    continue
                b_duration = booking.duration or 1
                b_slots = time_slots[b_start_idx : b_start_idx + b_duration]
                
                if slot in b_slots:
                    be = BookingEquipment.query.filter_by(
                        booking_id=booking.id,
                        equipment_id=equip_id
                    ).first()
                    if be:
                        total_booked += be.quantity
            
            if total_booked + req_qty > equip.total_available:
                return False
                
    return True
