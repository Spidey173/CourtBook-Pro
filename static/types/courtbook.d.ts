/**
 * CourtBook Pro — TypeScript Domain Declarations & Schema Contracts
 * Provides complete compile-time and editor type safety for the booking engine.
 */

export type CourtType = 'indoor' | 'outdoor';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Court {
    id: number;
    name: string;
    type: CourtType;
    base_price: number;
    is_active: boolean;
    created_at?: string;
}

export interface Coach {
    id: number;
    name: string;
    price: number;
    specialization?: string;
    is_active: boolean;
    created_at?: string;
}

export interface Equipment {
    id: number;
    name: string;
    price: number;
    available: number;
    total_available: number;
    is_active: boolean;
}

export interface PricingRule {
    enabled: boolean;
    multiplier?: number;
    start?: string;
    end?: string;
    applyDays?: string;
    discount?: number;
    discountPerHour?: number;
    minItems?: number;
}

export interface PricingRulesMap {
    peakHours?: PricingRule;
    weekend?: PricingRule;
    indoor?: PricingRule;
    multipleHours?: PricingRule;
    bundle?: PricingRule;
    [key: string]: PricingRule | undefined;
}

export interface BookingSlot {
    id?: number;
    booking_id: number;
    court_id: number;
    coach_id?: number | null;
    date: string;
    time_slot: string;
}

export interface BookingEquipmentItem {
    id?: number;
    equipment_id: number;
    name: string;
    quantity: number;
    price: number;
}

export interface Booking {
    id: number | string;
    user_id: number;
    court_id: number;
    court?: Court | null;
    coach_id?: number | null;
    coach?: Coach | null;
    date: string;
    time_slot: string;
    duration: number;
    total_price: number;
    status: BookingStatus;
    created_at?: string;
    equipment?: BookingEquipmentItem[];
    is_optimistic?: boolean;
}

export interface PriceBreakdownItem {
    label: string;
    value: number;
    type?: 'base' | 'surcharge' | 'discount' | 'coach' | 'equipment' | 'total';
}

export interface PriceCalculationResponse {
    total_price: number;
    breakdown: PriceBreakdownItem[];
    applied_rules: string[];
}

export interface BookingRequestPayload {
    court_id: number;
    date: string;
    time_slot: string;
    duration: number;
    coach_id: number | null;
    equipment: Record<number, number>;
}

export interface AvailabilityData {
    booked_time_slots?: Record<string | number, string[]>;
    booked_courts?: Record<string | number, string[]>;
    booked_coaches?: number[];
    equipment_availability?: Record<number, number>;
}

export interface BootstrapResponse {
    courts: Court[];
    coaches: Coach[];
    equipment: Equipment[];
    timeSlots: string[];
    pricingRules: PricingRulesMap;
    availability: AvailabilityData;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    booking_id?: number;
    total_price?: number;
}

export interface BookingState {
    date: string;
    duration: number;
    selectedCourt: Court | null;
    selectedSlot: string | null;
    selectedCoach: Coach | null;
    equipmentRequests: Record<number, number>;
    courts: Court[];
    coaches: Coach[];
    equipment: Equipment[];
    timeSlots: string[];
    pricingRules: PricingRulesMap;
    bookedCourtSlots: Record<string | number, string[]>;
    equipmentAvailability: Record<number, number>;
    optimisticLock: {
        courtId: number;
        slot: string;
        date: string;
    } | null;
}
