import sqlite3
import os
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import httpx
from app.core.config import settings
from app.core.supabase_sync import supabase_sync

LOCAL_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "round2_local.db"))

class DatabaseManager:
    def __init__(self):
        self.use_supabase = bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)
        self._init_local_db()

    def _init_local_db(self):
        """Initializes SQLite schema matching the PostgreSQL/Supabase schema."""
        conn = sqlite3.connect(LOCAL_DB_PATH)
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS participants (
                id TEXT PRIMARY KEY,
                auth_user_id TEXT,
                full_name TEXT NOT NULL,
                vtu_number TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                status TEXT NOT NULL DEFAULT 'Ready',
                is_disqualified INTEGER NOT NULL DEFAULT 0,
                disqualification_reason TEXT,
                warnings_count INTEGER NOT NULL DEFAULT 0,
                round2_score INTEGER DEFAULT NULL,
                extra_time_minutes INTEGER NOT NULL DEFAULT 0,
                submitted_at TEXT,
                last_active TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS participant_logins (
                id TEXT PRIMARY KEY,
                participant_id TEXT NOT NULL,
                full_name TEXT NOT NULL,
                vtu_number TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_plain TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                last_login_at TEXT,
                login_count INTEGER NOT NULL DEFAULT 1,
                ip_address TEXT DEFAULT '127.0.0.1',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS admins (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                password_hash TEXT,
                role TEXT NOT NULL DEFAULT 'admin',
                created_at TEXT
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS round2_questions (
                id TEXT PRIMARY KEY,
                question_number INTEGER UNIQUE NOT NULL,
                title TEXT NOT NULL,
                problem_statement TEXT NOT NULL,
                description TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                language TEXT NOT NULL DEFAULT 'python',
                starter_code TEXT,
                buggy_code TEXT NOT NULL,
                marks INTEGER NOT NULL DEFAULT 100,
                time_limit_seconds REAL NOT NULL DEFAULT 3.0,
                memory_limit_mb INTEGER NOT NULL DEFAULT 128,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS round2_test_cases (
                id TEXT PRIMARY KEY,
                question_id TEXT NOT NULL,
                input_data TEXT NOT NULL,
                expected_output TEXT NOT NULL,
                is_hidden INTEGER NOT NULL DEFAULT 0,
                marks INTEGER NOT NULL DEFAULT 20,
                order_index INTEGER NOT NULL DEFAULT 0,
                created_at TEXT,
                FOREIGN KEY (question_id) REFERENCES round2_questions(id) ON DELETE CASCADE
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS round2_submissions (
                id TEXT PRIMARY KEY,
                participant_id TEXT NOT NULL,
                question_id TEXT NOT NULL,
                code TEXT NOT NULL,
                language TEXT NOT NULL DEFAULT 'python',
                status TEXT NOT NULL DEFAULT 'Submitted',
                score INTEGER NOT NULL DEFAULT 0,
                max_score INTEGER NOT NULL DEFAULT 100,
                passed_cases INTEGER NOT NULL DEFAULT 0,
                total_cases INTEGER NOT NULL DEFAULT 0,
                execution_time_ms REAL DEFAULT 0,
                submitted_at TEXT,
                created_at TEXT,
                UNIQUE (participant_id, question_id)
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS round2_execution_results (
                id TEXT PRIMARY KEY,
                submission_id TEXT NOT NULL,
                test_case_id TEXT NOT NULL,
                status TEXT NOT NULL,
                actual_output TEXT,
                expected_output TEXT,
                execution_time_ms REAL,
                error_message TEXT,
                is_hidden INTEGER NOT NULL DEFAULT 0,
                created_at TEXT
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS round2_warnings (
                id TEXT PRIMARY KEY,
                participant_id TEXT NOT NULL,
                warning_number INTEGER NOT NULL,
                reason TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS round2_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                competition_name TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                duration_minutes INTEGER NOT NULL DEFAULT 90,
                is_active INTEGER NOT NULL DEFAULT 1,
                max_warnings INTEGER NOT NULL DEFAULT 3,
                auto_submit_on_expire INTEGER NOT NULL DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            )
        """)

        # Ensure default settings row exists
        c.execute("SELECT id FROM round2_settings WHERE id = 1")
        if not c.fetchone():
            now = datetime.now(timezone.utc).isoformat()
            c.execute("""
                INSERT INTO round2_settings (id, competition_name, duration_minutes, is_active, max_warnings, auto_submit_on_expire, created_at, updated_at)
                VALUES (1, 'Code Masters Round 2 - Python Debugging Challenge', 90, 1, 3, 1, ?, ?)
            """, (now, now))

        # Bootstrap Admin: remove old admin and configure new credentials
                # Migration: Ensure extra_time_minutes column exists on participants
        try:
            c.execute("ALTER TABLE participants ADD COLUMN extra_time_minutes INTEGER NOT NULL DEFAULT 0")
        except Exception:
            pass

        c.execute("DELETE FROM admins WHERE lower(email) = 'admin@codemasters.com'")
        c.execute("SELECT id FROM admins WHERE lower(email) = ?", (settings.ADMIN_DEFAULT_EMAIL.lower(),))
        if not c.fetchone():
            now = datetime.now(timezone.utc).isoformat()
            from app.core.security import get_password_hash
            c.execute("""
                INSERT INTO admins (id, email, full_name, password_hash, role, created_at)
                VALUES (?, ?, 'Prof. Kalaichelvi T', ?, 'super_admin', ?)
            """, (str(uuid.uuid4()), settings.ADMIN_DEFAULT_EMAIL.lower(), get_password_hash(settings.ADMIN_DEFAULT_PASSWORD), now))

        conn.commit()
        conn.close()

    def get_connection(self):
        conn = sqlite3.connect(LOCAL_DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    # -------------------------------------------------------------------------
    # PARTICIPANTS
    # -------------------------------------------------------------------------
    def get_participant_by_email_or_vtu(self, identifier: str) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("""
            SELECT * FROM participants 
            WHERE lower(email) = lower(?) OR upper(vtu_number) = upper(?)
        """, (identifier.strip(), identifier.strip()))
        row = c.fetchone()
        conn.close()
        return dict(row) if row else None

    def get_participant_by_id(self, participant_id: str) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("SELECT * FROM participants WHERE id = ?", (participant_id,))
        row = c.fetchone()
        conn.close()
        return dict(row) if row else None

    def create_participant(self, full_name: str, vtu_number: str, email: str, password_hash: str, password_plain: str = "") -> Dict[str, Any]:
        p_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("""
            INSERT INTO participants (
                id, auth_user_id, full_name, vtu_number, email, password_hash,
                status, is_disqualified, warnings_count, round2_score,
                last_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'Ready', 0, 0, NULL, ?, ?, ?)
        """, (p_id, p_id, full_name, vtu_number.upper(), email.lower(), password_hash, now, now, now))

        # Store in dedicated participant_logins table with plain password and login info
        login_id = str(uuid.uuid4())
        c.execute("""
            INSERT INTO participant_logins (
                id, participant_id, full_name, vtu_number, email,
                password_plain, password_hash, last_login_at, login_count,
                ip_address, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '127.0.0.1', ?, ?)
        """, (login_id, p_id, full_name, vtu_number.upper(), email.lower(), password_plain, password_hash, now, now, now))

        conn.commit()
        conn.close()
        p = self.get_participant_by_id(p_id)
        if p:
            supabase_sync.sync_participant(p)
        supabase_sync.sync_participant_login({
            "id": login_id,
            "participant_id": p_id,
            "full_name": full_name,
            "vtu_number": vtu_number.upper(),
            "email": email.lower(),
            "password_plain": password_plain,
            "password_hash": password_hash,
            "last_login_at": now,
            "login_count": 1,
            "ip_address": "127.0.0.1",
        })
        return p

    def update_participant_last_login(self, participant_id: str):
        conn = self.get_connection()
        c = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        c.execute("""
            UPDATE participant_logins SET
                last_login_at = ?,
                login_count = login_count + 1,
                updated_at = ?
            WHERE participant_id = ?
        """, (now, now, participant_id))
        c.execute("""
            UPDATE participants SET
                last_active = ?,
                updated_at = ?
            WHERE id = ?
        """, (now, now, participant_id))
        c.execute("SELECT * FROM participant_logins WHERE participant_id = ?", (participant_id,))
        l_row = c.fetchone()
        conn.commit()
        conn.close()

        p = self.get_participant_by_id(participant_id)
        if p:
            supabase_sync.sync_participant(p)
        if l_row:
            supabase_sync.sync_participant_login(dict(l_row))

    def update_participant(self, participant_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        fields = []
        vals = []
        for k, v in updates.items():
            fields.append(f"{k} = ?")
            vals.append(v)
        fields.append("updated_at = ?")
        vals.append(datetime.now(timezone.utc).isoformat())
        vals.append(participant_id)
        c.execute(f"UPDATE participants SET {', '.join(fields)} WHERE id = ?", vals)
        conn.commit()
        conn.close()
        p = self.get_participant_by_id(participant_id)
        if p:
            supabase_sync.sync_participant(p)
        return p

    def list_participants(self) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("""
            SELECT p.*, l.password_plain, l.last_login_at, l.login_count
            FROM participants p
            LEFT JOIN participant_logins l ON p.id = l.participant_id
            ORDER BY p.created_at DESC
        """)
        rows = c.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def list_participant_logins(self) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("SELECT * FROM participant_logins ORDER BY created_at DESC")
        rows = c.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def clear_all_participants_and_logins(self):
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("DELETE FROM round2_warnings")
        c.execute("DELETE FROM round2_execution_results")
        c.execute("DELETE FROM round2_submissions")
        c.execute("DELETE FROM participant_logins")
        c.execute("DELETE FROM participants")
        conn.commit()
        conn.close()

    def add_participant_extra_time(self, participant_id: str, minutes: int, reason: str = "") -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        c.execute("""
            UPDATE participants SET
                extra_time_minutes = coalesce(extra_time_minutes, 0) + ?,
                updated_at = ?
            WHERE id = ?
        """, (minutes, now, participant_id))
        conn.commit()
        conn.close()
        p = self.get_participant_by_id(participant_id)
        if p:
            supabase_sync.sync_participant(p)
        return p

    def add_all_participants_extra_time(self, minutes: int) -> int:
        conn = self.get_connection()
        c = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        c.execute("""
            UPDATE participants SET
                extra_time_minutes = coalesce(extra_time_minutes, 0) + ?,
                updated_at = ?
        """, (minutes, now))
        count = c.rowcount
        conn.commit()
        conn.close()
        for p in self.list_participants():
            supabase_sync.sync_participant(p)
        return count

    # -------------------------------------------------------------------------
    # ADMINS
    # -------------------------------------------------------------------------
    def get_admin_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("SELECT * FROM admins WHERE lower(email) = lower(?)", (email.strip(),))
        row = c.fetchone()
        conn.close()
        return dict(row) if row else None

    def create_admin(self, email: str, full_name: str, password_hash: str, role: str = "admin") -> Dict[str, Any]:
        admin_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("""
            INSERT INTO admins (id, email, full_name, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (admin_id, email.lower(), full_name, password_hash, role, now))
        conn.commit()
        conn.close()
        return self.get_admin_by_email(email)

    # -------------------------------------------------------------------------
    # QUESTIONS & TEST CASES
    # -------------------------------------------------------------------------
    def list_questions(self, active_only: bool = False, include_hidden: bool = True) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        if active_only:
            c.execute("SELECT * FROM round2_questions WHERE is_active = 1 ORDER BY question_number ASC")
        else:
            c.execute("SELECT * FROM round2_questions ORDER BY question_number ASC")
        rows = c.fetchall()
        conn.close()
        questions = [dict(r) for r in rows]
        for q in questions:
            q["is_active"] = bool(q["is_active"])
            q["test_cases"] = self.get_test_cases(q["id"], include_hidden=include_hidden)
        return questions

    def get_question_by_id(self, question_id: str, include_hidden: bool = False) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("SELECT * FROM round2_questions WHERE id = ?", (question_id,))
        row = c.fetchone()

        # Resilient fallbacks if not matched by direct ID
        if not row:
            canonical_to_num = {
                "a1111111-1111-1111-1111-111111111111": 1,
                "a2222222-2222-2222-2222-222222222222": 2,
                "a3333333-3333-3333-3333-333333333333": 3,
                "a4444444-4444-4444-4444-444444444444": 4,
                "a5555555-5555-5555-5555-555555555555": 5,
            }
            target_qnum = canonical_to_num.get(str(question_id).lower())
            if not target_qnum and str(question_id).isdigit():
                target_qnum = int(question_id)
            if target_qnum:
                c.execute("SELECT * FROM round2_questions WHERE question_number = ?", (target_qnum,))
                row = c.fetchone()

        conn.close()
        if not row:
            return None
        q = dict(row)
        q["is_active"] = bool(q["is_active"])
        q["test_cases"] = self.get_test_cases(q["id"], include_hidden=include_hidden)
        return q

    def get_active_question(self, include_hidden: bool = False) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("SELECT * FROM round2_questions WHERE is_active = 1 ORDER BY question_number ASC LIMIT 1")
        row = c.fetchone()
        conn.close()
        if not row:
            return None
        q = dict(row)
        q["is_active"] = bool(q["is_active"])
        q["test_cases"] = self.get_test_cases(q["id"], include_hidden=include_hidden)
        return q

    def create_question(self, q_data: Dict[str, Any]) -> Dict[str, Any]:
        q_id = q_data.get("id") or str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conn = self.get_connection()
        c = conn.cursor()
        # Find next question_number if not supplied or if colliding
        q_num = q_data.get("question_number")
        if q_num is None:
            c.execute("SELECT coalesce(max(question_number), 0) + 1 FROM round2_questions")
            q_num = c.fetchone()[0]

        # Check if question already exists with this id or number
        c.execute("SELECT id FROM round2_questions WHERE id = ? OR question_number = ?", (q_id, q_num))
        existing = c.fetchone()
        if existing:
            actual_id = existing[0]
            c.execute("""
                UPDATE round2_questions SET
                    id = ?, question_number = ?, title = ?, problem_statement = ?, description = ?,
                    difficulty = ?, language = ?, starter_code = ?, buggy_code = ?, marks = ?,
                    time_limit_seconds = ?, memory_limit_mb = ?, is_active = ?, updated_at = ?
                WHERE id = ?
            """, (
                q_id, q_num, q_data["title"], q_data.get("problem_statement", q_data.get("description", "")),
                q_data["description"], q_data.get("difficulty", "Medium"),
                q_data.get("language", "python"), q_data.get("starter_code", ""),
                q_data["buggy_code"], int(q_data.get("marks", 20)),
                float(q_data.get("time_limit_seconds", 3.0)), int(q_data.get("memory_limit_mb", 128)),
                1 if q_data.get("is_active", True) else 0, now, actual_id
            ))
        else:
            c.execute("""
                INSERT INTO round2_questions (
                    id, question_number, title, problem_statement, description,
                    difficulty, language, starter_code, buggy_code, marks,
                    time_limit_seconds, memory_limit_mb, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                q_id, q_num, q_data["title"], q_data.get("problem_statement", q_data.get("description", "")),
                q_data["description"], q_data.get("difficulty", "Medium"),
                q_data.get("language", "python"), q_data.get("starter_code", ""),
                q_data["buggy_code"], int(q_data.get("marks", 20)),
                float(q_data.get("time_limit_seconds", 3.0)), int(q_data.get("memory_limit_mb", 128)),
                1 if q_data.get("is_active", True) else 0, now, now
            ))
        conn.commit()
        conn.close()

        # Add initial test cases if provided
        test_cases = q_data.get("test_cases", [])
        if test_cases:
            conn = self.get_connection()
            c = conn.cursor()
            c.execute("DELETE FROM round2_test_cases WHERE question_id = ? OR question_id = ?", (q_id, str(existing[0]) if existing else q_id))
            conn.commit()
            conn.close()
            for idx, tc in enumerate(test_cases):
                self.create_test_case(q_id, tc.get("input_data", tc.get("input", "")), tc.get("expected_output", ""), bool(tc.get("is_hidden", False)), int(tc.get("marks", 10)), idx, tc_id=tc.get("id"))

        q = self.get_question_by_id(q_id, include_hidden=True)
        if q:
            supabase_sync.sync_question(q)
            for tc in q.get("test_cases", []):
                supabase_sync.sync_test_case(tc)
        return q

    def update_question(self, q_id: str, q_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        c.execute("""
            UPDATE round2_questions SET
                title = ?, problem_statement = ?, description = ?,
                difficulty = ?, language = ?, starter_code = ?, buggy_code = ?,
                marks = ?, time_limit_seconds = ?, memory_limit_mb = ?,
                is_active = ?, updated_at = ?
            WHERE id = ?
        """, (
            q_data["title"], q_data.get("problem_statement", q_data.get("description", "")),
            q_data["description"], q_data.get("difficulty", "Medium"),
            q_data.get("language", "python"), q_data.get("starter_code", ""),
            q_data["buggy_code"], int(q_data.get("marks", 100)),
            float(q_data.get("time_limit_seconds", 3.0)), int(q_data.get("memory_limit_mb", 128)),
            1 if q_data.get("is_active", True) else 0, now, q_id
        ))
        conn.commit()
        conn.close()

        # If test cases were passed in replacement
        if "test_cases" in q_data:
            self.replace_test_cases_for_question(q_id, q_data["test_cases"])

        q = self.get_question_by_id(q_id, include_hidden=True)
        if q:
            supabase_sync.sync_question(q)
            for tc in q.get("test_cases", []):
                supabase_sync.sync_test_case(tc)
        return q

    def delete_question(self, q_id: str) -> bool:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("DELETE FROM round2_test_cases WHERE question_id = ?", (q_id,))
        c.execute("DELETE FROM round2_questions WHERE id = ?", (q_id,))
        deleted = c.rowcount > 0
        conn.commit()
        conn.close()
        return deleted

    def get_test_cases(self, question_id: str, include_hidden: bool = False) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()

        actual_qid = question_id
        c.execute("SELECT id FROM round2_questions WHERE id = ?", (question_id,))
        if not c.fetchone():
            canonical_to_num = {
                "a1111111-1111-1111-1111-111111111111": 1,
                "a2222222-2222-2222-2222-222222222222": 2,
                "a3333333-3333-3333-3333-333333333333": 3,
                "a4444444-4444-4444-4444-444444444444": 4,
                "a5555555-5555-5555-5555-555555555555": 5,
            }
            target_qnum = canonical_to_num.get(str(question_id).lower())
            if not target_qnum and str(question_id).isdigit():
                target_qnum = int(question_id)
            if target_qnum:
                c.execute("SELECT id FROM round2_questions WHERE question_number = ?", (target_qnum,))
                found = c.fetchone()
                if found:
                    actual_qid = found[0]

        if include_hidden:
            c.execute("SELECT * FROM round2_test_cases WHERE question_id = ? ORDER BY order_index ASC", (actual_qid,))
        else:
            c.execute("SELECT id, question_id, input_data, expected_output, is_hidden, marks, order_index, created_at FROM round2_test_cases WHERE question_id = ? AND is_hidden = 0 ORDER BY order_index ASC", (actual_qid,))
        rows = c.fetchall()
        conn.close()
        cases = []
        for r in rows:
            d = dict(r)
            d["is_hidden"] = bool(d["is_hidden"])
            cases.append(d)
        return cases

    def create_test_case(self, question_id: str, input_data: str, expected_output: str, is_hidden: bool, marks: int, order_index: int, tc_id: Optional[str] = None) -> Dict[str, Any]:
        tc_id = tc_id or str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("""
            INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (tc_id, question_id, input_data, expected_output, 1 if is_hidden else 0, marks, order_index, now))
        conn.commit()
        conn.close()
        tc_dict = {"id": tc_id, "question_id": question_id, "input_data": input_data, "expected_output": expected_output, "is_hidden": is_hidden, "marks": marks, "order_index": order_index}
        supabase_sync.sync_test_case(tc_dict)
        return tc_dict

    def replace_test_cases_for_question(self, question_id: str, test_cases: List[Dict[str, Any]]):
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("DELETE FROM round2_test_cases WHERE question_id = ?", (question_id,))
        now = datetime.now(timezone.utc).isoformat()
        for idx, tc in enumerate(test_cases):
            tc_id = str(tc.get("id") or uuid.uuid4())
            c.execute("""
                INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (tc_id, question_id, tc.get("input_data", tc.get("input", "")), tc.get("expected_output", ""), 1 if tc.get("is_hidden") else 0, int(tc.get("marks", 20)), idx + 1, now))
        conn.commit()
        conn.close()

    # -------------------------------------------------------------------------
    # SUBMISSIONS & RESULTS
    # -------------------------------------------------------------------------
    def get_submission_by_participant(self, participant_id: str, question_id: str) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("""
            SELECT s.*, p.full_name as participant_name, p.vtu_number
            FROM round2_submissions s
            JOIN participants p ON s.participant_id = p.id
            WHERE s.participant_id = ? AND s.question_id = ?
        """, (participant_id, question_id))
        row = c.fetchone()
        conn.close()
        if not row:
            return None
        sub = dict(row)
        sub["execution_results"] = self.get_execution_results_for_submission(sub["id"], is_admin=False)
        return sub

    def save_submission(self, sub_data: Dict[str, Any], results: List[Dict[str, Any]]) -> Dict[str, Any]:
        sub_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        conn = self.get_connection()
        c = conn.cursor()

        # Check existing submission
        c.execute("SELECT id FROM round2_submissions WHERE participant_id = ? AND question_id = ?", (sub_data["participant_id"], sub_data["question_id"]))
        existing = c.fetchone()
        if existing:
            sub_id = existing[0]
            c.execute("""
                UPDATE round2_submissions SET
                    code = ?, status = ?, score = ?, max_score = ?,
                    passed_cases = ?, total_cases = ?, execution_time_ms = ?,
                    submitted_at = ?
                WHERE id = ?
            """, (
                sub_data["code"], sub_data.get("status", "Submitted"),
                sub_data["score"], sub_data["max_score"],
                sub_data["passed_cases"], sub_data["total_cases"],
                sub_data.get("execution_time_ms", 0), now, sub_id
            ))
            # Delete old execution results
            c.execute("DELETE FROM round2_execution_results WHERE submission_id = ?", (sub_id,))
        else:
            c.execute("""
                INSERT INTO round2_submissions (
                    id, participant_id, question_id, code, language, status,
                    score, max_score, passed_cases, total_cases, execution_time_ms,
                    submitted_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                sub_id, sub_data["participant_id"], sub_data["question_id"],
                sub_data["code"], sub_data.get("language", "python"),
                sub_data.get("status", "Submitted"), sub_data["score"],
                sub_data["max_score"], sub_data["passed_cases"],
                sub_data["total_cases"], sub_data.get("execution_time_ms", 0),
                now, now
            ))

        # Insert detailed execution results
        for r in results:
            res_id = str(uuid.uuid4())
            c.execute("""
                INSERT INTO round2_execution_results (
                    id, submission_id, test_case_id, status, actual_output,
                    expected_output, execution_time_ms, error_message, is_hidden, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                res_id, sub_id, r["test_case_id"], r["status"],
                r.get("actual_output", ""), r.get("expected_output", ""),
                r.get("execution_time_ms", 0), r.get("error_message"),
                1 if r.get("is_hidden") else 0, now
            ))

        # Calculate total active questions count
        c.execute("SELECT count(*) FROM round2_questions WHERE is_active = 1")
        total_active_q = c.fetchone()[0]

        # Calculate how many distinct active questions this participant has submitted and total score
        c.execute("""
            SELECT count(DISTINCT s.question_id), coalesce(SUM(s.score), 0)
            FROM round2_submissions s
            JOIN round2_questions q ON s.question_id = q.id
            WHERE s.participant_id = ? AND q.is_active = 1
        """, (sub_data["participant_id"],))
        row = c.fetchone()
        submitted_count = row[0] if row else 0
        total_score = row[1] if row else 0

        is_all_submitted = (total_active_q > 0 and submitted_count >= total_active_q) or sub_data.get("is_final_contest_submit", False)
        new_status = 'Submitted' if is_all_submitted else 'In Progress'

        # Update participant score and status
        c.execute("""
            UPDATE participants SET
                round2_score = ?,
                status = ?,
                submitted_at = CASE WHEN ? = 'Submitted' THEN ? ELSE submitted_at END,
                updated_at = ?
            WHERE id = ?
        """, (total_score, new_status, new_status, now, now, sub_data["participant_id"]))

        conn.commit()
        conn.close()

        sub = self.get_submission_by_participant(sub_data["participant_id"], sub_data["question_id"])
        if sub:
            sub["total_active_questions"] = total_active_q
            sub["submitted_questions_count"] = submitted_count
            sub["total_accumulated_score"] = total_score
            sub["is_all_submitted"] = is_all_submitted
            sub["participant_status"] = new_status
            supabase_sync.sync_submission(sub, results)
        p = self.get_participant_by_id(sub_data["participant_id"])
        if p:
            supabase_sync.sync_participant(p)
        return sub

    def unlock_submission(self, participant_id: str, question_id: Optional[str] = None) -> bool:
        conn = self.get_connection()
        c = conn.cursor()
        if question_id:
            c.execute("DELETE FROM round2_submissions WHERE participant_id = ? AND question_id = ?", (participant_id, question_id))
        else:
            c.execute("DELETE FROM round2_submissions WHERE participant_id = ?", (participant_id,))
        c.execute("""
            UPDATE participants SET
                round2_score = NULL, status = 'Ready', submitted_at = NULL, updated_at = ?
            WHERE id = ?
        """, (datetime.now(timezone.utc).isoformat(), participant_id))
        conn.commit()
        conn.close()
        return True

    def list_submissions(self) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("""
            SELECT s.*, p.full_name as participant_name, p.vtu_number, p.email as participant_email,
                   q.title as question_title
            FROM round2_submissions s
            JOIN participants p ON s.participant_id = p.id
            JOIN round2_questions q ON s.question_id = q.id
            ORDER BY s.score DESC, s.submitted_at ASC
        """)
        rows = c.fetchall()
        conn.close()
        subs = []
        for r in rows:
            sub = dict(r)
            sub["execution_results"] = self.get_execution_results_for_submission(sub["id"], is_admin=True)
            subs.append(sub)
        return subs

    def get_execution_results_for_submission(self, submission_id: str, is_admin: bool = False) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("""
            SELECT * FROM round2_execution_results WHERE submission_id = ?
        """, (submission_id,))
        rows = c.fetchall()
        conn.close()
        res_list = []
        for r in rows:
            d = dict(r)
            d["is_hidden"] = bool(d["is_hidden"])
            if not is_admin and d["is_hidden"]:
                d["expected_output"] = "[HIDDEN TEST CASE]"
                if d["status"] != "Passed":
                    d["actual_output"] = "[OUTPUT CONCEALED]"
            res_list.append(d)
        return res_list

    # -------------------------------------------------------------------------
    # WARNINGS
    # -------------------------------------------------------------------------
    def log_warning(self, participant_id: str, reason: str, message: str) -> Dict[str, Any]:
        p = self.get_participant_by_id(participant_id)
        if not p:
            return {"error": "Participant not found"}

        new_count = p["warnings_count"] + 1
        settings = self.get_settings()
        max_w = settings.get("max_warnings", 3)
        disqualified = new_count >= max_w

        conn = self.get_connection()
        c = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        w_id = str(uuid.uuid4())
        c.execute("""
            INSERT INTO round2_warnings (id, participant_id, warning_number, reason, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (w_id, participant_id, new_count, reason, message, now))

        c.execute("""
            UPDATE participants SET
                warnings_count = ?,
                is_disqualified = ?,
                disqualification_reason = ?,
                status = ?,
                updated_at = ?
            WHERE id = ?
        """, (
            new_count,
            1 if disqualified else 0,
            f"Exceeded maximum proctoring warnings ({new_count}/{max_w})" if disqualified else p.get("disqualification_reason"),
            "Disqualified" if disqualified else p["status"],
            now,
            participant_id
        ))
        conn.commit()
        conn.close()

        updated_p = self.get_participant_by_id(participant_id)
        if updated_p:
            supabase_sync.sync_participant(updated_p)
        supabase_sync.sync_warning({
            "id": w_id,
            "participant_id": participant_id,
            "warning_number": new_count,
            "reason": reason,
            "message": message
        })

        return {
            "warning_id": w_id,
            "warnings_count": new_count,
            "max_warnings": max_w,
            "is_disqualified": disqualified,
            "reason": reason,
            "message": message,
        }

    def reset_warnings(self, participant_id: str) -> bool:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("DELETE FROM round2_warnings WHERE participant_id = ?", (participant_id,))
        c.execute("""
            UPDATE participants SET
                warnings_count = 0, is_disqualified = 0, disqualification_reason = NULL,
                status = 'Ready', updated_at = ?
            WHERE id = ?
        """, (datetime.now(timezone.utc).isoformat(), participant_id))
        conn.commit()
        conn.close()
        p = self.get_participant_by_id(participant_id)
        if p:
            supabase_sync.sync_participant(p)
        return True

    # -------------------------------------------------------------------------
    # SETTINGS & TELEMETRY
    # -------------------------------------------------------------------------
    def get_settings(self) -> Dict[str, Any]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("SELECT * FROM round2_settings WHERE id = 1")
        row = c.fetchone()
        conn.close()
        if not row:
            return {"id": 1, "competition_name": "Code Masters Round 2", "duration_minutes": 90, "is_active": True, "max_warnings": 3}
        d = dict(row)
        d["is_active"] = bool(d["is_active"])
        d["auto_submit_on_expire"] = bool(d["auto_submit_on_expire"])
        return d

    def update_settings(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        conn = self.get_connection()
        c = conn.cursor()
        fields = []
        vals = []
        for k, v in updates.items():
            if k in ["competition_name", "start_time", "end_time", "duration_minutes", "is_active", "max_warnings", "auto_submit_on_expire"]:
                fields.append(f"{k} = ?")
                vals.append(int(v) if isinstance(v, bool) else v)
        fields.append("updated_at = ?")
        vals.append(datetime.now(timezone.utc).isoformat())
        c.execute(f"UPDATE round2_settings SET {', '.join(fields)} WHERE id = 1", vals)
        conn.commit()
        conn.close()
        s = self.get_settings()
        supabase_sync.sync_settings(s)
        return s

    def get_admin_telemetry(self) -> Dict[str, Any]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM participants")
        total_participants = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM participants WHERE status = 'In Progress'")
        active_participants = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM participants WHERE status = 'Submitted'")
        submitted_participants = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM participants WHERE status = 'Ready'")
        pending_participants = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM participants WHERE is_disqualified = 1")
        disqualified_participants = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM round2_questions")
        total_questions = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM round2_submissions")
        total_submissions = c.fetchone()[0]

        c.execute("SELECT coalesce(avg(score), 0) FROM round2_submissions")
        avg_score = round(c.fetchone()[0], 1)

        conn.close()
        return {
            "total_participants": total_participants,
            "active_participants": active_participants,
            "submitted_participants": submitted_participants,
            "pending_participants": pending_participants,
            "disqualified_participants": disqualified_participants,
            "total_questions": total_questions,
            "total_submissions": total_submissions,
            "average_score": avg_score,
        }

    def get_participant_submissions_summary(self, participant_id: str) -> Dict[str, Any]:
        conn = self.get_connection()
        c = conn.cursor()

        # Get active questions count
        c.execute("SELECT count(*) FROM round2_questions WHERE is_active = 1")
        total_questions = c.fetchone()[0]

        # Get all submissions for participant
        c.execute("""
            SELECT s.question_id, s.score, s.max_score, s.passed_cases, s.total_cases,
                   s.submitted_at, s.status, q.title as question_title, q.question_number, q.marks
            FROM round2_submissions s
            JOIN round2_questions q ON s.question_id = q.id
            WHERE s.participant_id = ? AND q.is_active = 1
            ORDER BY q.question_number ASC
        """, (participant_id,))
        rows = c.fetchall()

        # Get participant status and score
        c.execute("SELECT status, round2_score, submitted_at, is_disqualified FROM participants WHERE id = ?", (participant_id,))
        p_row = c.fetchone()
        conn.close()

        submissions_list = []
        submissions_map = {}
        total_score = 0
        for r in rows:
            sub_item = dict(r)
            submissions_list.append(sub_item)
            submissions_map[sub_item["question_id"]] = sub_item
            total_score += int(sub_item["score"] or 0)

        p_status = p_row[0] if p_row else "Ready"
        is_all_submitted = (total_questions > 0 and len(submissions_list) >= total_questions) or (p_status == "Submitted")

        return {
            "total_questions": total_questions,
            "submitted_count": len(submissions_list),
            "is_all_submitted": is_all_submitted,
            "participant_status": p_status,
            "total_score": total_score,
            "max_possible_score": total_questions * 20 if total_questions > 0 else 100,
            "submissions": submissions_list,
            "submissions_map": submissions_map,
        }

    def finish_participant_contest(self, participant_id: str) -> Dict[str, Any]:
        """Explicitly marks contest as completed for a participant and locks in final score."""
        conn = self.get_connection()
        c = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()

        c.execute("""
            SELECT coalesce(SUM(s.score), 0)
            FROM round2_submissions s
            JOIN round2_questions q ON s.question_id = q.id
            WHERE s.participant_id = ? AND q.is_active = 1
        """, (participant_id,))
        total_score = c.fetchone()[0]

        c.execute("""
            UPDATE participants SET
                round2_score = ?,
                status = 'Submitted',
                submitted_at = ?,
                updated_at = ?
            WHERE id = ?
        """, (total_score, now, now, participant_id))
        conn.commit()
        conn.close()
        return self.get_participant_submissions_summary(participant_id)

    def seed_round2_standard_suite(self) -> List[Dict[str, Any]]:
        """Seeds the official 5-question Round 2 prototype suite (20 marks each, 100 marks total)."""
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("DELETE FROM round2_test_cases")
        c.execute("DELETE FROM round2_submissions")
        c.execute("DELETE FROM round2_execution_results")
        c.execute("DELETE FROM round2_questions")
        conn.commit()
        conn.close()

        suite = [
            {
                "id": "a1111111-1111-1111-1111-111111111111",
                "question_number": 1,
                "title": "Even & Odd Number Counter",
                "problem_statement": "A program receives a list of integers and must count how many numbers are even and how many are odd.",
                "description": "Debug the loop and condition so every number is checked exactly once. The program should print the two counts.\n\nInput:\nA list of integers.\n\nOutput:\nPrint the number of even values and odd values in the format:\nEven: <count>\nOdd: <count>",
                "difficulty": "Easy",
                "language": "python",
                "starter_code": "numbers = [12, 7, 4, 9, 18, 5, 10]\n\neven = 0\nodd = 0\n\nfor n in numbers:\n    if n % 2 == 1:\n        even += 1\n    else:\n        odd += 1\n\nprint(\"Even:\", even)\nprint(\"Odd:\", odd)",
                "buggy_code": "numbers = [12, 7, 4, 9, 18, 5, 10]\n\neven = 0\nodd = 0\n\nfor n in numbers:\n    if n % 2 == 1:\n        even += 1\n    else:\n        odd += 1\n\nprint(\"Even:\", even)\nprint(\"Odd:\", odd)",
                "marks": 20,
                "time_limit_seconds": 3.0,
                "memory_limit_mb": 128,
                "is_active": True,
                "test_cases": [
                    {"id": "b1111111-1111-1111-1111-111111111111", "input_data": "[12, 7, 4, 9, 18, 5, 10]", "expected_output": "Even: 4\nOdd: 3", "is_hidden": False, "marks": 10},
                    {"id": "b1111111-1111-1111-1111-111111111112", "input_data": "[2, 4, 6, 8, 10]", "expected_output": "Even: 5\nOdd: 0", "is_hidden": True, "marks": 10}
                ]
            },
            {
                "id": "a2222222-2222-2222-2222-222222222222",
                "question_number": 2,
                "title": "Student Average Function",
                "problem_statement": "A student result program uses a function to calculate total, average, and pass/fail status from a list of marks.",
                "description": "Debug the function so it returns the correct average. A student passes only when the average is at least 40.\n\nInput:\nA list of integer marks.\n\nOutput:\nPrint Total, Average (2 decimal places), and Result in the format:\nTotal: <total>\nAverage: <average>\nResult: <PASS/FAIL>",
                "difficulty": "Medium",
                "language": "python",
                "starter_code": "def calculate_result(marks):\n    total = 0\n    for mark in marks:\n        total += marks\n    average = total / len(marks)\n    if average > 40:\n        result = \"PASS\"\n    else:\n        result = \"FAIL\"\n    return total, average, result\n\nmarks = [35, 45, 50, 40, 30]\ntotal, average, result = calculate_result(marks)\n\nprint(\"Total:\", total)\nprint(\"Average:\", round(average, 2))\nprint(\"Result:\", result)",
                "buggy_code": "def calculate_result(marks):\n    total = 0\n    for mark in marks:\n        total += marks\n    average = total / len(marks)\n    if average > 40:\n        result = \"PASS\"\n    else:\n        result = \"FAIL\"\n    return total, average, result\n\nmarks = [35, 45, 50, 40, 30]\ntotal, average, result = calculate_result(marks)\n\nprint(\"Total:\", total)\nprint(\"Average:\", round(average, 2))\nprint(\"Result:\", result)",
                "marks": 20,
                "time_limit_seconds": 3.0,
                "memory_limit_mb": 128,
                "is_active": True,
                "test_cases": [
                    {"id": "b2222222-2222-2222-2222-222222222221", "input_data": "[35, 45, 50, 40, 30]", "expected_output": "Total: 200\nAverage: 40.0\nResult: PASS", "is_hidden": False, "marks": 10},
                    {"id": "b2222222-2222-2222-2222-222222222222", "input_data": "[80, 70, 90, 60, 50]", "expected_output": "Total: 350\nAverage: 70.0\nResult: PASS", "is_hidden": True, "marks": 10}
                ]
            },
            {
                "id": "a3333333-3333-3333-3333-333333333333",
                "question_number": 3,
                "title": "Student Dictionary Lookup",
                "problem_statement": "A student-record program stores names and marks in a dictionary. It should display the requested student's mark and convert the name to uppercase.",
                "description": "Debug the dictionary access and string operation. The requested key exists in the given test cases.\n\nInput:\nA dictionary of student names and marks, plus a student name to search.\n\nOutput:\nPrint the student's uppercase name and mark in the format:\nName: <UPPERCASE_NAME>\nMark: <mark>",
                "difficulty": "Medium",
                "language": "python",
                "starter_code": "students = {\n    \"Ravi\": 78,\n    \"Anu\": 85,\n    \"Kiran\": 69\n}\n\nname = \"Anu\"\n\nprint(\"Name:\", students[name].upper())\nprint(\"Mark:\", students[name])",
                "buggy_code": "students = {\n    \"Ravi\": 78,\n    \"Anu\": 85,\n    \"Kiran\": 69\n}\n\nname = \"Anu\"\n\nprint(\"Name:\", students[name].upper())\nprint(\"Mark:\", students[name])",
                "marks": 20,
                "time_limit_seconds": 3.0,
                "memory_limit_mb": 128,
                "is_active": True,
                "test_cases": [
                    {"id": "b3333333-3333-3333-3333-333333333331", "input_data": "students={\"Ravi\": 78, \"Anu\": 85, \"Kiran\": 69}; name=\"Anu\"", "expected_output": "Name: ANU\nMark: 85", "is_hidden": False, "marks": 10},
                    {"id": "b3333333-3333-3333-3333-333333333332", "input_data": "students={\"Ravi\": 78, \"Anu\": 85, \"Kiran\": 69}; name=\"Ravi\"", "expected_output": "Name: RAVI\nMark: 78", "is_hidden": True, "marks": 10}
                ]
            },
            {
                "id": "a4444444-4444-4444-4444-444444444444",
                "question_number": 4,
                "title": "Marks File Average",
                "problem_statement": "A small result utility reads marks from a text file, one mark per line, and calculates the average. Blank lines may occur.",
                "description": "Debug the program so blank lines are ignored and the average is calculated from the valid numeric marks. Keep the solution compact; no advanced file-processing techniques are required.\n\nInput:\nA text file 'marks.txt' containing one mark per line.\n\nOutput:\nPrint the number of marks and the average rounded to 2 decimal places in the format:\nCount: <count>\nAverage: <average>",
                "difficulty": "Hard",
                "language": "python",
                "starter_code": "def read_marks(filename):\n    file = open(filename, \"r\")\n    marks = []\n    for line in file:\n        marks.append(int(line))\n    file.close()\n    return marks\n\nmarks = read_marks(\"marks.txt\")\naverage = sum(marks) / len(marks)\n\nprint(\"Count:\", len(marks))\nprint(\"Average:\", round(average, 2))",
                "buggy_code": "def read_marks(filename):\n    file = open(filename, \"r\")\n    marks = []\n    for line in file:\n        marks.append(int(line))\n    file.close()\n    return marks\n\nmarks = read_marks(\"marks.txt\")\naverage = sum(marks) / len(marks)\n\nprint(\"Count:\", len(marks))\nprint(\"Average:\", round(average, 2))",
                "marks": 20,
                "time_limit_seconds": 3.0,
                "memory_limit_mb": 128,
                "is_active": True,
                "test_cases": [
                    {"id": "b4444444-4444-4444-4444-444444444441", "input_data": "70\n80\n\n90", "expected_output": "Count: 3\nAverage: 80.0", "is_hidden": False, "marks": 10},
                    {"id": "b4444444-4444-4444-4444-444444444442", "input_data": "50\n60\n70\n80", "expected_output": "Count: 4\nAverage: 65.0", "is_hidden": True, "marks": 10}
                ]
            },
            {
                "id": "a5555555-5555-5555-5555-555555555555",
                "question_number": 5,
                "title": "NumPy Marks Analysis",
                "problem_statement": "A small marks-analysis program uses NumPy to find the highest mark and then places the marks into a Pandas DataFrame for display.",
                "description": "Debug the NumPy maximum calculation and the DataFrame column construction. Keep the program short and use only basic NumPy/Pandas operations.\n\nInput:\nA one-dimensional NumPy array of marks.\n\nOutput:\nPrint the highest mark and a DataFrame containing the marks in the format:\nHighest: <highest>\nDataFrame Marks column contains: <mark1>, <mark2>, ...",
                "difficulty": "Hard",
                "language": "python",
                "starter_code": "import numpy as np\nimport pandas as pd\n\nmarks = np.array([72, 88, 65, 91, 79])\n\nhighest = marks.min()\ndf = pd.DataFrame({\"Marks\": highest})\n\nprint(\"Highest:\", highest)\nprint(df)",
                "buggy_code": "import numpy as np\nimport pandas as pd\n\nmarks = np.array([72, 88, 65, 91, 79])\n\nhighest = marks.min()\ndf = pd.DataFrame({\"Marks\": highest})\n\nprint(\"Highest:\", highest)\nprint(df)",
                "marks": 20,
                "time_limit_seconds": 3.0,
                "memory_limit_mb": 128,
                "is_active": True,
                "test_cases": [
                    {"id": "b5555555-5555-5555-5555-555555555551", "input_data": "[72, 88, 65, 91, 79]", "expected_output": "Highest: 91\nDataFrame Marks column contains: 72, 88, 65, 91, 79", "is_hidden": False, "marks": 10},
                    {"id": "b5555555-5555-5555-5555-555555555552", "input_data": "[55, 60, 82, 74]", "expected_output": "Highest: 82\nDataFrame Marks column contains: 55, 60, 82, 74", "is_hidden": True, "marks": 10}
                ]
            }
        ]

        created_questions = []
        for q in suite:
            created = self.create_question(q)
            created_questions.append(created)
        return created_questions

    def add_participant_extra_time(self, participant_id: str, extra_minutes: int, reason: str = "") -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        c.execute("""
            UPDATE participants SET
                extra_time_minutes = coalesce(extra_time_minutes, 0) + ?,
                updated_at = ?
            WHERE id = ?
        """, (extra_minutes, now, participant_id))
        conn.commit()
        conn.close()
        return self.get_participant_by_id(participant_id)

    def add_all_participants_extra_time(self, extra_minutes: int) -> int:
        conn = self.get_connection()
        c = conn.cursor()
        now = datetime.now(timezone.utc).isoformat()
        c.execute("""
            UPDATE participants SET
                extra_time_minutes = coalesce(extra_time_minutes, 0) + ?,
                updated_at = ?
        """, (extra_minutes, now))
        count = c.rowcount
        conn.commit()
        conn.close()
        return count

    def get_leaderboard(self) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("""
            SELECT p.id as participant_id, p.full_name, p.vtu_number, p.email,
                   coalesce(p.round2_score, 0) as score,
                   100 as max_score,
                   p.submitted_at,
                   coalesce(sum(s.passed_cases), 0) as passed_cases,
                   coalesce(sum(s.total_cases), 0) as total_cases,
                   coalesce(sum(s.execution_time_ms), 0) as execution_time_ms,
                   p.status, p.is_disqualified
            FROM participants p
            LEFT JOIN round2_submissions s ON p.id = s.participant_id
            WHERE p.status = 'Submitted' OR p.round2_score IS NOT NULL
            GROUP BY p.id
            ORDER BY coalesce(p.round2_score, 0) DESC, p.submitted_at ASC
        """)
        rows = c.fetchall()
        conn.close()
        leaderboard = []
        for rank, r in enumerate(rows, 1):
            entry = dict(r)
            entry["rank"] = rank
            leaderboard.append(entry)
        return leaderboard

db = DatabaseManager()
