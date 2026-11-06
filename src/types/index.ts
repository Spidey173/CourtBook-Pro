export interface Court {
  id: number;
  name: string;
  type: 'indoor' | 'outdoor';
  base_price: number;
  basePrice?: number;
  is_active: boolean;
  isActive?: boolean;
  totalBookings?: number;
  createdAt?: string;
}

export interface Coach {
  id: number;
  name: string;
  price: number;
  specialization: string;
  is_active: boolean;
  isActive?: boolean;
  totalSessions?: number;
  createdAt?: string;
}

export interface Equipment {
  id: number;
  name: string;
  price: number;
  total_available: number;
  totalAvailable?: number;
  available_now?: number;
  is_active: boolean;
  isActive?: boolean;
  createdAt?: string;
}

export interface PricingRule {
  id?: number;
  rule_type: string;
  enabled: boolean;
  multiplier?: number;
  discount?: number;
  discountPerHour?: number;
  start_time?: string;
  end_time?: string;
  apply_days?: string;
  min_items?: number;
  minItems?: number;
}

export interface BookingSlot {
  id: number;
  booking_id: number;
  court_id: number;
  coach_id?: number | null;
  date: string;
  time_slot: string;
  start_time_utc?: string;
  end_time_utc?: string;
}

export interface BookingEquipment {
  equipment_id: number;
  quantity: number;
  equipment?: Equipment;
}

export interface Booking {
  id: number;
  user_id: number;
  court_id: number;
  coach_id?: number | null;
  date: string;
  time_slot: string;
  timeSlot?: string;
  duration: number;
  total_price: number;
  totalPrice?: number;
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  created_at: string;
  start_time_utc?: string;
  end_time_utc?: string;
  timezone?: string;
  court?: Court;
  coach?: Coach | null;
  user?: User;
  slots?: BookingSlot[];
  equipment_items?: BookingEquipment[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  isAdmin?: boolean;
  is_active?: boolean;
  created_at?: string;
  totalBookings?: number;
  totalSpent?: number;
}

export interface PriceBreakdownItem {
  label: string;
  amount: number;
  value?: number;
  type: string;
}

export interface PriceCalculation {
  total_price: number;
  totalPrice: number;
  base_price: number;
  duration: number;
  breakdown: PriceBreakdownItem[];
  applied_rules: string[];
}

export interface BootstrapData {
  courts: Court[];
  coaches: Coach[];
  equipment: Equipment[];
  timeSlots: string[];
  pricingRules: Record<string, any>;
  availability: {
    booked_slots: Record<number, string[]>;
    coach_booked_slots: Record<number, string[]>;
  };
}

export interface AdminStats {
  totalRevenue: number;
  totalBookings: number;
  activeCourts: number;
  totalUsers: number;
  recentBookings?: Booking[];
  courtUtilization?: Record<string, number>;
}

