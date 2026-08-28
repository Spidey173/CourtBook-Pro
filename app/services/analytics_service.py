"""Cross-Database Analytics & Reporting Service."""
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import func, extract
from app.extensions import db
from app.models.user import User
from app.models.court import Court
from app.models.booking import Booking, BookingStatus


class AnalyticsService:
    """Provides business intelligence metrics and reports compatible with SQLite and PostgreSQL."""

    @staticmethod
    def _get_month_expression():
        """Returns dialect-appropriate month grouping expression."""
        dialect = db.engine.dialect.name
        if dialect == 'sqlite':
            return db.func.strftime('%Y-%m', Booking.date)
        elif dialect in ('postgresql', 'postgres'):
            return db.func.to_char(Booking.date, 'YYYY-MM')
        else:
            # Fallback for MySQL/MariaDB or standard SQL
            return db.func.concat(
                extract('year', Booking.date),
                '-',
                db.func.lpad(extract('month', Booking.date).cast(db.String), 2, '0')
            )

    @classmethod
    def get_dashboard_summary(cls) -> Dict[str, Any]:
        """Calculates high-level KPI dashboard statistics."""
        today = date.today()
        total_users = User.query.count()
        total_bookings = Booking.query.filter(Booking.status != BookingStatus.CANCELLED.value).count()
        active_bookings = Booking.query.filter(
            Booking.date >= today,
            Booking.status != BookingStatus.CANCELLED.value
        ).count()
        today_bookings = Booking.query.filter(
            Booking.date == today,
            Booking.status != BookingStatus.CANCELLED.value
        ).count()

        total_revenue = db.session.query(
            db.func.sum(Booking.total_price)
        ).filter(Booking.status != BookingStatus.CANCELLED.value).scalar() or 0

        # Monthly revenue (last 6 months)
        month_expr = cls._get_month_expression()
        six_months_ago = today - timedelta(days=180)

        monthly_rev_query = db.session.query(
            month_expr.label('month'),
            db.func.sum(Booking.total_price).label('revenue')
        ).filter(
            Booking.date >= six_months_ago,
            Booking.status != BookingStatus.CANCELLED.value
        ).group_by(month_expr).order_by(month_expr.desc()).limit(6).all()

        return {
            'totalUsers': total_users,
            'totalBookings': total_bookings,
            'activeBookings': active_bookings,
            'todayBookings': today_bookings,
            'totalRevenue': total_revenue,
            'monthlyRevenue': [{'month': str(row[0]), 'revenue': int(row[1] or 0)} for row in monthly_rev_query]
        }

    @classmethod
    def get_detailed_revenue_report(
        cls,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Generates comprehensive revenue reports with court breakdowns and customer rankings."""
        query = Booking.query.filter(Booking.status != BookingStatus.CANCELLED.value)

        if start_date:
            query = query.filter(Booking.date >= start_date)
        if end_date:
            query = query.filter(Booking.date <= end_date)

        total_rev = db.session.query(db.func.sum(Booking.total_price)).filter(
            Booking.status != BookingStatus.CANCELLED.value
        )
        if start_date:
            total_rev = total_rev.filter(Booking.date >= start_date)
        if end_date:
            total_rev = total_rev.filter(Booking.date <= end_date)

        total_revenue = total_rev.scalar() or 0
        total_bookings = query.count()

        # Revenue by court type
        revenue_by_court_query = db.session.query(
            Court.type,
            db.func.sum(Booking.total_price)
        ).join(Court, Booking.court_id == Court.id).filter(
            Booking.status != BookingStatus.CANCELLED.value
        )
        if start_date:
            revenue_by_court_query = revenue_by_court_query.filter(Booking.date >= start_date)
        if end_date:
            revenue_by_court_query = revenue_by_court_query.filter(Booking.date <= end_date)

        revenue_by_court = [
            {'type': row[0], 'revenue': int(row[1] or 0)}
            for row in revenue_by_court_query.group_by(Court.type).all()
        ]

        # Monthly breakdown (last 12 months)
        month_expr = cls._get_month_expression()
        monthly_query = db.session.query(
            month_expr.label('month'),
            db.func.count(Booking.id),
            db.func.sum(Booking.total_price)
        ).filter(
            Booking.status != BookingStatus.CANCELLED.value
        )
        if start_date:
            monthly_query = monthly_query.filter(Booking.date >= start_date)
        if end_date:
            monthly_query = monthly_query.filter(Booking.date <= end_date)

        monthly_breakdown = [
            {'month': str(row[0]), 'bookings': int(row[1] or 0), 'revenue': int(row[2] or 0)}
            for row in monthly_query.group_by(month_expr).order_by(month_expr.desc()).limit(12).all()
        ]

        # Top 10 users by spend
        top_users_query = db.session.query(
            User.username,
            db.func.count(Booking.id).label('booking_count'),
            db.func.sum(Booking.total_price).label('total_spent')
        ).join(Booking, User.id == Booking.user_id).filter(
            Booking.status != BookingStatus.CANCELLED.value
        ).group_by(User.id, User.username).order_by(
            db.func.sum(Booking.total_price).desc()
        ).limit(10).all()

        top_users = [
            {'username': row[0], 'bookings': int(row[1] or 0), 'totalSpent': int(row[2] or 0)}
            for row in top_users_query
        ]

        return {
            'totalRevenue': total_revenue,
            'totalBookings': total_bookings,
            'revenueByCourt': revenue_by_court,
            'revenueByMonth': monthly_breakdown,
            'topUsers': top_users
        }
