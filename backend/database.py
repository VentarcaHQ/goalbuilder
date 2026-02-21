"""
Database connection and schema setup.
All tables are created on startup if they don't exist.

Tables:
  reports      — one row per generated PDF report (anonymous, UUID-keyed)
  daily_usage  — rate limiting tracker (ip_hash × date)
  subscribers  — newsletter opt-ins (email only, optional)
"""
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from config import settings

# ─── Connection ────────────────────────────────────────────────────────────────

def get_connection():
    return psycopg2.connect(settings.DATABASE_URL)


@contextmanager
def db():
    """Context manager that yields a cursor and auto-commits on success."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ─── Schema ────────────────────────────────────────────────────────────────────

CREATE_REPORTS_TABLE = """
CREATE TABLE IF NOT EXISTS reports (
    id               SERIAL PRIMARY KEY,
    uuid             VARCHAR(36)  UNIQUE NOT NULL,
    created_at       TIMESTAMP    DEFAULT NOW(),
    downloaded_at    TIMESTAMP    NULL,
    country          VARCHAR(10)  NOT NULL,
    goal_name        VARCHAR(255) NOT NULL,
    ip_hash          VARCHAR(64)  NOT NULL,
    paid             BOOLEAN      DEFAULT FALSE,
    stripe_session_id VARCHAR(255) NULL
);
"""

CREATE_DAILY_USAGE_TABLE = """
CREATE TABLE IF NOT EXISTS daily_usage (
    ip_hash          VARCHAR(64) NOT NULL,
    date             DATE        NOT NULL,
    free_count       INTEGER     DEFAULT 0,
    paid_count       INTEGER     DEFAULT 0,
    PRIMARY KEY (ip_hash, date)
);
"""

# Emails are stored as-is in v1. Encrypt at the database/column level in production.
CREATE_SUBSCRIBERS_TABLE = """
CREATE TABLE IF NOT EXISTS subscribers (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    subscribed_at   TIMESTAMP    DEFAULT NOW(),
    country         VARCHAR(10)  NULL,
    source          VARCHAR(50)  DEFAULT 'pdf_download',
    active          BOOLEAN      DEFAULT TRUE
);
"""


def init_db():
    """Create tables on application startup."""
    with db() as cur:
        cur.execute(CREATE_REPORTS_TABLE)
        cur.execute(CREATE_DAILY_USAGE_TABLE)
        cur.execute(CREATE_SUBSCRIBERS_TABLE)
    print("[DB] Schema initialized.")


# ─── Report helpers ────────────────────────────────────────────────────────────

def insert_report(uuid: str, country: str, goal_name: str, ip_hash: str) -> None:
    with db() as cur:
        cur.execute(
            "INSERT INTO reports (uuid, country, goal_name, ip_hash) VALUES (%s, %s, %s, %s)",
            (uuid, country, goal_name, ip_hash),
        )


def mark_report_downloaded(uuid: str) -> None:
    with db() as cur:
        cur.execute(
            "UPDATE reports SET downloaded_at = NOW() WHERE uuid = %s",
            (uuid,),
        )


def mark_report_paid(uuid: str, stripe_session_id: str) -> None:
    with db() as cur:
        cur.execute(
            "UPDATE reports SET paid = TRUE, stripe_session_id = %s WHERE uuid = %s",
            (stripe_session_id, uuid),
        )


# ─── Rate limiting helpers ─────────────────────────────────────────────────────

def get_today_usage(ip_hash: str) -> dict:
    """Returns {free_count, paid_count} for today. Returns zeros if no row yet."""
    with db() as cur:
        cur.execute(
            "SELECT free_count, paid_count FROM daily_usage WHERE ip_hash = %s AND date = CURRENT_DATE",
            (ip_hash,),
        )
        row = cur.fetchone()
    return dict(row) if row else {"free_count": 0, "paid_count": 0}


def increment_free_count(ip_hash: str) -> None:
    with db() as cur:
        cur.execute(
            """
            INSERT INTO daily_usage (ip_hash, date, free_count)
                VALUES (%s, CURRENT_DATE, 1)
            ON CONFLICT (ip_hash, date)
                DO UPDATE SET free_count = daily_usage.free_count + 1
            """,
            (ip_hash,),
        )


def increment_paid_count(ip_hash: str) -> None:
    with db() as cur:
        cur.execute(
            """
            INSERT INTO daily_usage (ip_hash, date, paid_count)
                VALUES (%s, CURRENT_DATE, 1)
            ON CONFLICT (ip_hash, date)
                DO UPDATE SET paid_count = daily_usage.paid_count + 1
            """,
            (ip_hash,),
        )


# ─── Subscriber helpers ────────────────────────────────────────────────────────

def insert_subscriber(email: str, country: str | None) -> bool:
    """
    Returns True if newly subscribed, False if already exists.
    """
    with db() as cur:
        cur.execute(
            """
            INSERT INTO subscribers (email, country)
                VALUES (%s, %s)
            ON CONFLICT (email) DO NOTHING
            """,
            (email, country),
        )
        return cur.rowcount == 1


# ─── Admin stats helpers ───────────────────────────────────────────────────────

def get_admin_stats() -> dict:
    with db() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM reports")
        total = cur.fetchone()["total"]

        cur.execute("SELECT COUNT(*) AS today FROM reports WHERE DATE(created_at) = CURRENT_DATE")
        today = cur.fetchone()["today"]

        cur.execute("SELECT COUNT(*) AS week FROM reports WHERE created_at >= NOW() - INTERVAL '7 days'")
        week = cur.fetchone()["week"]

        cur.execute("SELECT COUNT(*) AS month FROM reports WHERE created_at >= NOW() - INTERVAL '30 days'")
        month = cur.fetchone()["month"]

        cur.execute("SELECT country, COUNT(*) AS count FROM reports GROUP BY country ORDER BY count DESC")
        by_country = {row["country"]: row["count"] for row in cur.fetchall()}

        cur.execute("SELECT COUNT(*) AS paid FROM reports WHERE paid = TRUE")
        paid = cur.fetchone()["paid"]

        cur.execute("SELECT COUNT(*) AS subs FROM subscribers WHERE active = TRUE")
        subscribers = cur.fetchone()["subs"]

    return {
        "total_reports": total,
        "reports_today": today,
        "reports_this_week": week,
        "reports_this_month": month,
        "reports_by_country": by_country,
        "total_paid_reports": paid,
        "total_revenue_usd": round(paid * 3.00, 2),
        "total_subscribers": subscribers,
    }
