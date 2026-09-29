import os
import sys

# Ensure execution engine app is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from runner import run_single_test_case, execute_test_suite

def test_correct_code():
    code = """
import sys
data = sys.stdin.read().strip()
print(int(data) * 2)
"""
    res = run_single_test_case(code, input_data="21", expected_output="42")
    assert res.passed is True
    assert res.status == "Passed"
    assert res.actual_output == "42"
    print("[PASS] test_correct_code")

def test_wrong_code():
    code = """
print("wrong")
"""
    res = run_single_test_case(code, input_data="", expected_output="correct")
    assert res.passed is False
    assert res.status == "Failed"
    print("[PASS] test_wrong_code")

def test_infinite_loop_timeout():
    code = """
while True:
    pass
"""
    res = run_single_test_case(code, input_data="", expected_output="", time_limit_seconds=1.0)
    assert res.passed is False
    assert res.status == "Timeout"
    print("[PASS] test_infinite_loop_timeout")

def test_syntax_error():
    code = """
def broken(:
"""
    res = run_single_test_case(code, input_data="", expected_output="")
    assert res.passed is False
    assert res.status == "Error"
    print("[PASS] test_syntax_error")

def test_environment_sanitization():
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "super_secret_value_12345"
    code = """
import os
val = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "NOT_FOUND")
print(val)
"""
    res = run_single_test_case(code, input_data="", expected_output="NOT_FOUND")
    assert res.passed is True
    assert res.actual_output == "NOT_FOUND"
    print("[PASS] test_environment_sanitization")

if __name__ == "__main__":
    test_correct_code()
    test_wrong_code()
    test_infinite_loop_timeout()
    test_syntax_error()
    test_environment_sanitization()
    print("\nALL RUNNER TESTS PASSED SUCCESSFULLY!")
