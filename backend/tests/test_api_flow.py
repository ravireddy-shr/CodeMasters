import os
import sys
import uuid

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_api_flow():
    # 1. Health Check
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "online"
    print("[PASS] Health check")

    # 2. Admin Login
    admin_login = client.post("/api/auth/admin/login", json={
        "email": "kalaichelvit@veltech.edu.in",
        "password": "Admin@cseaiml26"
    })
    assert admin_login.status_code == 200, admin_login.text
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] Admin login")

    # 3. Admin Creates Round 2 Question with 1 Public and 1 Hidden test case
    q_payload = {
        "question_number": 1,
        "title": "Square Calculator Bug",
        "problem_statement": "Given an integer n, calculate its square n^2.",
        "description": "Read integer n from standard input and print n^2 to standard output.",
        "difficulty": "Easy",
        "language": "python",
        "starter_code": "def solution(n):\n    return n * n\n\nif __name__ == '__main__':\n    import sys\n    print(solution(int(sys.stdin.read().strip())))",
        "buggy_code": "def solution(n):\n    return n + n # Bug: adds instead of squaring\n\nif __name__ == '__main__':\n    import sys\n    print(solution(int(sys.stdin.read().strip())))",
        "marks": 100,
        "time_limit_seconds": 3.0,
        "is_active": True,
        "test_cases": [
            {
                "input_data": "5",
                "expected_output": "25",
                "is_hidden": False,
                "marks": 50,
                "order_index": 1
            },
            {
                "input_data": "12",
                "expected_output": "144",
                "is_hidden": True,
                "marks": 50,
                "order_index": 2
            }
        ]
    }
    q_res = client.post("/api/admin/questions", json=q_payload, headers=admin_headers)
    assert q_res.status_code == 200, q_res.text
    question_data = q_res.json()
    q_id = question_data["id"]
    assert len(question_data["test_cases"]) == 2
    print("[PASS] Admin question creation")

    # 4. Participant Registration & Login
    unique_suffix = uuid.uuid4().hex[:6].upper()
    test_vtu = f"VTU{unique_suffix}"
    test_email = f"test_{unique_suffix.lower()}@veltech.edu.in"
    test_pwd = "Password@123"

    p_reg = client.post("/api/auth/participant/register", json={
        "full_name": "Test Participant",
        "vtu_number": test_vtu,
        "email": test_email,
        "password": test_pwd
    })
    assert p_reg.status_code == 200, p_reg.text
    # Login
    p_login = client.post("/api/auth/participant/login", json={
        "email_or_vtu": test_vtu,
        "password": test_pwd
    })
    assert p_login.status_code == 200, p_login.text
    p_token = p_login.json()["access_token"]
    p_headers = {"Authorization": f"Bearer {p_token}"}
    print("[PASS] Participant login")

    # 5. Participant Gets Active Question - VERIFY HIDDEN TEST CASE IS NOT EXPOSED!
    active_q = client.get("/api/questions/active", headers=p_headers)
    assert active_q.status_code == 200, active_q.text
    active_q_data = active_q.json()
    assert len(active_q_data["test_cases"]) == 1, "Security violation: Hidden test case was leaked to participant!"
    assert active_q_data["test_cases"][0]["is_hidden"] is False
    print("[PASS] Hidden test case isolation check")

    # 5b. Participant Gets All Questions List (Sync Check)
    all_qs = client.get("/api/questions", headers=p_headers)
    assert all_qs.status_code == 200, all_qs.text
    qs_list = all_qs.json()
    assert len(qs_list) >= 1
    # Ensure hidden test cases are masked in list as well
    for tc in qs_list[0]["test_cases"]:
        assert tc["is_hidden"] is False
    print("[PASS] Multi-question list synchronization check")

    # 6. Participant Runs Buggy Code and Receives Mistake Line & Advice Tip
    syntax_bug_code = """
def solution(n):
    return n +
"""
    bug_res = client.post("/api/code/run", json={
        "question_id": q_id,
        "code": syntax_bug_code,
        "language": "python"
    }, headers=p_headers)
    assert bug_res.status_code == 200, bug_res.text
    bug_data = bug_res.json()
    assert bug_data["passed_count"] == 0
    first_res = bug_data["results"][0]
    assert first_res["error_line"] is not None
    assert first_res["error_tip"] is not None
    assert "syntax" in first_res["error_type"].lower()
    print(f"[PASS] Error line detection and advice tips: Line {first_res['error_line']} - {first_res['error_tip']}")

    # 6b. Participant Runs Code against Public Test Case
    fixed_code = """
import sys
n = int(sys.stdin.read().strip())
print(n * n)
"""
    run_res = client.post("/api/code/run", json={
        "question_id": q_id,
        "code": fixed_code,
        "language": "python"
    }, headers=p_headers)
    assert run_res.status_code == 200, run_res.text
    run_data = run_res.json()
    assert run_data["total_test_cases"] == 1
    assert run_data["passed_count"] == 1
    assert run_data["results"][0]["passed"] is True
    print("[PASS] Participant Run Code against public test case")

    # 7. Step-by-Step Multi-Question Execution & 5-Question Suite Testing
    # Admin deletes the temporary single question and seeds the 5 official Round 2 prototype questions
    client.delete(f"/api/admin/questions/{q_id}", headers=admin_headers)

    seed_res = client.post("/api/admin/questions/seed-round2-suite", headers=admin_headers)
    assert seed_res.status_code == 200, seed_res.text
    print("[PASS] Admin seeded 5 Round 2 prototype questions")

    # Fetch all questions as participant
    all_qs_res = client.get("/api/questions", headers=p_headers)
    assert all_qs_res.status_code == 200
    questions_list = all_qs_res.json()
    assert len(questions_list) >= 5
    total_max_marks = sum(q["marks"] for q in questions_list[:5])
    assert total_max_marks == 100, f"Expected 100 total marks across 5 questions, got {total_max_marks}"
    print(f"[PASS] 5 questions configured with 20 marks each (Total: {total_max_marks} Marks)")

    # Solutions for the 5 prototype questions
    solutions = [
        # Q1: Even & Odd Counter
        """
numbers = [12, 7, 4, 9, 18, 5, 10]
even = 0
odd = 0
for n in numbers:
    if n % 2 == 0:
        even += 1
    else:
        odd += 1
print("Even:", even)
print("Odd:", odd)
""",
        # Q2: Student Average Function
        """
def calculate_result(marks):
    total = 0
    for mark in marks:
        total += mark
    average = total / len(marks)
    if average >= 40:
        result = "PASS"
    else:
        result = "FAIL"
    return total, average, result

marks = [35, 45, 50, 40, 30]
total, average, result = calculate_result(marks)
print("Total:", total)
print("Average:", round(average, 2))
print("Result:", result)
""",
        # Q3: Student Dictionary Lookup
        """
students = {
    "Ravi": 78,
    "Anu": 85,
    "Kiran": 69
}
name = "Anu"
print("Name:", name.upper())
print("Mark:", students[name])
""",
        # Q4: Marks File Average
        """
def read_marks(filename):
    file = open(filename, "r")
    marks = []
    for line in file:
        line = line.strip()
        if line:
            marks.append(int(line))
    file.close()
    return marks

marks = read_marks("marks.txt")
average = sum(marks) / len(marks)
print("Count:", len(marks))
print("Average:", round(average, 2))
""",
        # Q5: NumPy Marks Analysis
        """
import numpy as np
import pandas as pd
marks = np.array([72, 88, 65, 91, 79])
highest = marks.max()
df = pd.DataFrame({"Marks": marks})
print("Highest:", highest)
print(df)
"""
    ]

    # Step-by-Step execution from question 1 to 5
    for i in range(5):
        q = questions_list[i]
        sol_code = solutions[i]
        sub_r = client.post("/api/submissions/submit", json={
            "question_id": q["id"],
            "code": sol_code,
            "language": "python"
        }, headers=p_headers)
        assert sub_r.status_code == 200, sub_r.text
        sub_d = sub_r.json()
        assert sub_d["score"] == 20, f"Expected 20 marks for Q{i+1}, got {sub_d['score']}"

        # Check progress
        prog_r = client.get("/api/submissions/progress", headers=p_headers)
        assert prog_r.status_code == 200
        prog_d = prog_r.json()
        assert prog_d["submitted_count"] == i + 1

        if i < 4:
            # During steps 1 to 4, participant must NOT be marked as finalized
            assert sub_d["is_all_submitted"] is False
            assert sub_d["participant_status"] == "In Progress"
            print(f"[PASS] Step {i+1}/5 completed: Q{i+1} submitted (Score: 20/20). In Progress.")
        else:
            # On final 5th question, all questions are submitted!
            assert sub_d["is_all_submitted"] is True
            assert sub_d["participant_status"] == "Submitted"
            assert sub_d["total_accumulated_score"] == 100
            print(f"[PASS] Step 5/5 completed: All 5 questions submitted! Total Score: {sub_d['total_accumulated_score']}/100 Marks.")

    # 8. Admin Views Submissions, Aggregated Leaderboard, and Telemetry
    subs_list = client.get("/api/admin/submissions", headers=admin_headers)
    assert subs_list.status_code == 200
    assert len(subs_list.json()) >= 5

    leaderboard = client.get("/api/admin/leaderboard", headers=admin_headers)
    assert leaderboard.status_code == 200
    assert len(leaderboard.json()) >= 1
    my_entry = next((e for e in leaderboard.json() if e["vtu_number"] == test_vtu), None)
    assert my_entry is not None, f"Participant {test_vtu} not found in leaderboard"
    assert my_entry["score"] == 100
    print("[PASS] Admin leaderboard reflects authoritative aggregated 100/100 marks!")

    stats = client.get("/api/admin/stats", headers=admin_headers)
    assert stats.status_code == 200
    assert stats.json()["total_submissions"] >= 5
    print("[PASS] Admin stats telemetry verified")

    # 9. Admin Views Participants and Checks Participant Logins Table Integration
    parts_res = client.get("/api/admin/participants", headers=admin_headers)
    assert parts_res.status_code == 200
    participants_list = parts_res.json()
    test_participant_entry = next((p for p in participants_list if p["vtu_number"] == test_vtu), None)
    assert test_participant_entry is not None
    assert test_participant_entry.get("password_plain") == test_pwd
    assert test_participant_entry.get("login_count", 0) >= 1
    print(f"[PASS] Participant logins verified in Admin Portal: password={test_participant_entry.get('password_plain')}, logins={test_participant_entry.get('login_count')}")

    print("\nALL 5-QUESTION STEP-BY-STEP API FLOW TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_full_api_flow()
