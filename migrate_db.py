# migrate_db.py
import sqlite3
import os

# Set absolute path to courtbook.db in the instance folder
base_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(base_dir, 'instance', 'courtbook.db')

def run_migration():
    if not os.path.exists(db_path):
        print(f"No database found at {db_path}, skipping migration.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Start transaction
        cursor.execute("BEGIN TRANSACTION;")

        # Check if status column already exists in bookings to avoid double running
        cursor.execute("PRAGMA table_info(bookings);")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'status' in columns:
            print("Database already migrated.")
            cursor.execute("ROLLBACK;")
            conn.close()
            return

        print("Migrating bookings and booking_equipment tables...")

        # 1. Rename old bookings table
        cursor.execute("ALTER TABLE bookings RENAME TO bookings_old;")

        # 2. Create new bookings table with status, duration, and foreign keys/unique constraints
        cursor.execute("""
        CREATE TABLE bookings (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            court_id INTEGER NOT NULL,
            coach_id INTEGER,
            date DATE NOT NULL,
            time_slot VARCHAR(10) NOT NULL,
            duration INTEGER NOT NULL DEFAULT 1,
            total_price INTEGER NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at DATETIME,
            FOREIGN KEY(user_id) REFERENCES users (id),
            FOREIGN KEY(court_id) REFERENCES courts (id),
            FOREIGN KEY(coach_id) REFERENCES coaches (id),
            CONSTRAINT unique_court_booking UNIQUE (court_id, date, time_slot),
            CONSTRAINT unique_coach_booking UNIQUE (coach_id, date, time_slot)
        );
        """)

        # 3. Create indexes for bookings to speed up queries
        cursor.execute("CREATE INDEX idx_bookings_date ON bookings (date);")
        cursor.execute("CREATE INDEX idx_bookings_user_status ON bookings (user_id, status);")
        cursor.execute("CREATE INDEX idx_bookings_date_time ON bookings (date, time_slot);")
        cursor.execute("CREATE INDEX idx_bookings_court_date ON bookings (court_id, date);")
        cursor.execute("CREATE INDEX idx_bookings_coach_date ON bookings (coach_id, date);")

        # 4. Copy data from bookings_old to bookings (assigning duration=1 and status='confirmed' to existing items)
        cursor.execute("""
        INSERT INTO bookings (id, user_id, court_id, coach_id, date, time_slot, duration, total_price, status, created_at)
        SELECT id, user_id, court_id, coach_id, date, time_slot, 1, total_price, 'confirmed', created_at
        FROM bookings_old;
        """)

        # 5. Rename old booking_equipment table
        cursor.execute("ALTER TABLE booking_equipment RENAME TO booking_equipment_old;")

        # 6. Create new booking_equipment table
        cursor.execute("""
        CREATE TABLE booking_equipment (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            equipment_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            FOREIGN KEY(booking_id) REFERENCES bookings (id),
            FOREIGN KEY(equipment_id) REFERENCES equipment (id)
        );
        """)

        # 7. Create indexes for booking_equipment
        cursor.execute("CREATE INDEX idx_booking_equipment_booking ON booking_equipment (booking_id);")
        cursor.execute("CREATE INDEX idx_booking_equipment_equipment ON booking_equipment (equipment_id);")

        # 8. Copy data from booking_equipment_old to booking_equipment
        cursor.execute("""
        INSERT INTO booking_equipment (id, booking_id, equipment_id, quantity)
        SELECT id, booking_id, equipment_id, quantity
        FROM booking_equipment_old;
        """)

        # 9. Drop old tables
        cursor.execute("DROP TABLE bookings_old;")
        cursor.execute("DROP TABLE booking_equipment_old;")

        # Commit transaction
        conn.commit()
        print("Database migration completed successfully!")

    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        raise e
    finally:
        conn.close()

if __name__ == '__main__':
    run_migration()
