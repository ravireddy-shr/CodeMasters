import os
import logging
from typing import Dict, Any, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("supabase_sync")

class SupabaseSyncService:
    def __init__(self):
        self.url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else ""
        self.api_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY or ""
        self.is_configured = bool(self.url and self.api_key)

    def _get_headers(self) -> Dict[str, str]:
        return {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        }

    def _get_client(self) -> Optional[httpx.Client]:
        if not self.is_configured:
            return None
        return httpx.Client(
            base_url=f"{self.url}/rest/v1",
            headers=self._get_headers(),
            timeout=10.0,
        )

    def sync_participant(self, p: Dict[str, Any]) -> bool:
        if not self.is_configured:
            return False
        try:
            with self._get_client() as client:
                payload = {
                    "id": p["id"],
                    "auth_user_id": p.get("auth_user_id") or p["id"],
                    "full_name": p["full_name"],
                    "vtu_number": p["vtu_number"],
                    "email": p["email"],
                    "status": p.get("status", "Ready"),
                    "is_disqualified": bool(p.get("is_disqualified", 0)),
                    "disqualification_reason": p.get("disqualification_reason"),
                    "warnings_count": int(p.get("warnings_count", 0)),
                    "round2_score": p.get("round2_score"),
                    "extra_time_minutes": int(p.get("extra_time_minutes", 0)),
                    "submitted_at": p.get("submitted_at"),
                    "last_active": p.get("last_active"),
                }
                r = client.post("/participants?on_conflict=id", json=payload)
                if r.status_code in [200, 201]:
                    logger.info(f"Synced participant {p['vtu_number']} to Supabase.")
                    return True
                elif r.status_code == 400 and "extra_time_minutes" in r.text:
                    # Retry without extra_time_minutes if column not yet added to Supabase
                    payload.pop("extra_time_minutes", None)
                    r2 = client.post("/participants?on_conflict=id", json=payload)
                    if r2.status_code in [200, 201]:
                        logger.info(f"Synced participant {p['vtu_number']} to Supabase (without extra_time_minutes).")
                        return True
                    else:
                        logger.warning(f"Failed to sync participant {p['vtu_number']} retry: {r2.status_code} {r2.text}")
                        return False
                else:
                    logger.warning(f"Failed to sync participant {p['vtu_number']} to Supabase: {r.status_code} {r.text}")
                    return False
        except Exception as e:
            logger.error(f"Error syncing participant {p.get('vtu_number')}: {e}")
            return False

    def sync_participant_login(self, login_data: Dict[str, Any]) -> bool:
        if not self.is_configured:
            return False
        try:
            with self._get_client() as client:
                payload = {
                    "participant_id": login_data["participant_id"],
                    "full_name": login_data["full_name"],
                    "vtu_number": login_data["vtu_number"],
                    "email": login_data["email"],
                    "password_plain": login_data.get("password_plain", ""),
                    "password_hash": login_data.get("password_hash", ""),
                    "last_login_at": login_data.get("last_login_at"),
                    "login_count": int(login_data.get("login_count", 1)),
                    "ip_address": login_data.get("ip_address", "127.0.0.1"),
                }
                if login_data.get("id"):
                    payload["id"] = login_data["id"]
                r = client.post("/participant_logins?on_conflict=vtu_number", json=payload)
                if r.status_code in [200, 201]:
                    logger.info(f"Synced login record for {login_data['vtu_number']} to Supabase.")
                    return True
                else:
                    logger.warning(f"Failed to sync login for {login_data['vtu_number']} to Supabase: {r.status_code} {r.text}")
                    return False
        except Exception as e:
            logger.error(f"Error syncing login for {login_data.get('vtu_number')}: {e}")
            return False

    def sync_submission(self, sub: Dict[str, Any], results: List[Dict[str, Any]] = None) -> bool:
        if not self.is_configured:
            return False
        try:
            with self._get_client() as client:
                sub_payload = {
                    "id": sub["id"],
                    "participant_id": sub["participant_id"],
                    "question_id": sub["question_id"],
                    "code": sub["code"],
                    "language": sub.get("language", "python"),
                    "status": sub.get("status", "Submitted"),
                    "score": int(sub.get("score", 0)),
                    "max_score": int(sub.get("max_score", 100)),
                    "passed_cases": int(sub.get("passed_cases", 0)),
                    "total_cases": int(sub.get("total_cases", 0)),
                    "execution_time_ms": float(sub.get("execution_time_ms", 0)),
                    "submitted_at": sub.get("submitted_at"),
                }
                r = client.post("/round2_submissions?on_conflict=participant_id,question_id", json=sub_payload)
                if r.status_code not in [200, 201]:
                    logger.warning(f"Failed to sync submission to Supabase: {r.status_code} {r.text}")

                if results:
                    # Clean up old execution results for this submission
                    try:
                        client.delete(f"/round2_execution_results?submission_id=eq.{sub['id']}")
                    except Exception:
                        pass
                    for res in results:
                        res_payload = {
                            "submission_id": sub["id"],
                            "test_case_id": res.get("test_case_id"),
                            "status": res.get("status", "Passed"),
                            "actual_output": res.get("actual_output", ""),
                            "expected_output": res.get("expected_output", ""),
                            "execution_time_ms": float(res.get("execution_time_ms", 0)),
                            "error_message": res.get("error_message"),
                            "is_hidden": bool(res.get("is_hidden", False)),
                        }
                        client.post("/round2_execution_results", json=res_payload)
                return True
        except Exception as e:
            logger.error(f"Error syncing submission {sub.get('id')}: {e}")
            return False

    def sync_warning(self, w: Dict[str, Any]) -> bool:
        if not self.is_configured:
            return False
        try:
            with self._get_client() as client:
                payload = {
                    "participant_id": w["participant_id"],
                    "warning_number": int(w.get("warning_number", 1)),
                    "reason": w.get("reason", "Proctoring Alert"),
                    "message": w.get("message", ""),
                }
                if w.get("id"):
                    payload["id"] = w["id"]
                client.post("/round2_warnings", json=payload)
                return True
        except Exception as e:
            logger.error(f"Error syncing warning: {e}")
            return False

    def sync_settings(self, s: Dict[str, Any]) -> bool:
        if not self.is_configured:
            return False
        try:
            with self._get_client() as client:
                payload = {
                    "id": 1,
                    "competition_name": s.get("competition_name", "Code Masters Round 2 - Python Debugging Challenge"),
                    "duration_minutes": int(s.get("duration_minutes", 90)),
                    "is_active": bool(s.get("is_active", True)),
                    "max_warnings": int(s.get("max_warnings", 3)),
                    "auto_submit_on_expire": bool(s.get("auto_submit_on_expire", True)),
                }
                client.post("/round2_settings?on_conflict=id", json=payload)
                return True
        except Exception as e:
            logger.error(f"Error syncing settings: {e}")
            return False

    def sync_question(self, q: Dict[str, Any]) -> bool:
        if not self.is_configured:
            return False
        try:
            with self._get_client() as client:
                payload = {
                    "id": q["id"],
                    "question_number": int(q["question_number"]),
                    "title": q["title"],
                    "problem_statement": q.get("problem_statement") or q.get("description", ""),
                    "description": q.get("description", ""),
                    "difficulty": q.get("difficulty", "Medium"),
                    "language": q.get("language", "python"),
                    "starter_code": q.get("starter_code", ""),
                    "buggy_code": q["buggy_code"],
                    "marks": int(q.get("marks", 20)),
                    "time_limit_seconds": float(q.get("time_limit_seconds", 3.0)),
                    "memory_limit_mb": int(q.get("memory_limit_mb", 128)),
                    "is_active": bool(q.get("is_active", True)),
                }
                r = client.post("/round2_questions?on_conflict=id", json=payload)
                return r.status_code in [200, 201]
        except Exception as e:
            logger.error(f"Error syncing question: {e}")
            return False

    def sync_test_case(self, tc: Dict[str, Any]) -> bool:
        if not self.is_configured:
            return False
        try:
            with self._get_client() as client:
                payload = {
                    "id": tc["id"],
                    "question_id": tc["question_id"],
                    "input_data": tc.get("input_data", ""),
                    "expected_output": tc.get("expected_output", ""),
                    "is_hidden": bool(tc.get("is_hidden", False)),
                    "marks": int(tc.get("marks", 10)),
                    "order_index": int(tc.get("order_index", 0)),
                }
                r = client.post("/round2_test_cases?on_conflict=id", json=payload)
                return r.status_code in [200, 201]
        except Exception as e:
            logger.error(f"Error syncing test case: {e}")
            return False

    def sync_all_from_local_db(self, db) -> Dict[str, int]:
        if not self.is_configured:
            return {"synced": 0, "error": "Not configured"}
        conn = db.get_connection()
        counts = {
            "settings": 0,
            "questions": 0,
            "test_cases": 0,
            "participants": 0,
            "logins": 0,
            "submissions": 0,
        }
        try:
            # 1. Settings
            settings_row = db.get_settings()
            if settings_row and self.sync_settings(settings_row):
                counts["settings"] += 1

            # 2. Questions & Test cases
            q_rows = conn.execute("SELECT * FROM round2_questions").fetchall()
            for r in q_rows:
                q_dict = dict(r)
                if self.sync_question(q_dict):
                    counts["questions"] += 1
                tc_rows = conn.execute("SELECT * FROM round2_test_cases WHERE question_id = ?", (q_dict["id"],)).fetchall()
                for tc in tc_rows:
                    if self.sync_test_case(dict(tc)):
                        counts["test_cases"] += 1

            # 3. Participants
            p_rows = conn.execute("SELECT * FROM participants").fetchall()
            for r in p_rows:
                if self.sync_participant(dict(r)):
                    counts["participants"] += 1

            # 4. Logins
            l_rows = conn.execute("SELECT * FROM participant_logins").fetchall()
            for r in l_rows:
                if self.sync_participant_login(dict(r)):
                    counts["logins"] += 1

            # 5. Submissions & Results
            s_rows = conn.execute("SELECT * FROM round2_submissions").fetchall()
            for r in s_rows:
                sub_dict = dict(r)
                res_rows = conn.execute("SELECT * FROM round2_execution_results WHERE submission_id = ?", (sub_dict["id"],)).fetchall()
                results_list = [dict(x) for x in res_rows]
                if self.sync_submission(sub_dict, results_list):
                    counts["submissions"] += 1

            logger.info(f"Sync complete from local SQLite to Supabase: {counts}")
            return counts
        except Exception as e:
            logger.error(f"Error during sync_all_from_local_db: {e}")
            return counts
        finally:
            conn.close()

supabase_sync = SupabaseSyncService()
