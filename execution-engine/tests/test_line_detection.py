import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))

from runner import run_single_test_case

def test_syntax_error_line_detection():
    code = """line1 = 1
line2 = 2
if line1 > 0
    print('missing colon')
"""
    res = run_single_test_case(code, input_data="", expected_output="")
    assert res.passed is False
    assert res.status == "Error"
    assert res.error_line == 3
    assert res.error_type == "SyntaxError"
    assert "Line 3" in res.error_tip
    print(f"[PASS] SyntaxError line detection: Line {res.error_line} - Tip: {res.error_tip}")

def test_zerodivision_line_detection():
    code = """a = 10
b = 0
result = a / b
print(result)
"""
    res = run_single_test_case(code, input_data="", expected_output="0")
    assert res.passed is False
    assert res.status == "Error"
    assert res.error_line == 3
    assert res.error_type == "ZeroDivisionError"
    assert "Line 3" in res.error_tip
    print(f"[PASS] ZeroDivisionError line detection: Line {res.error_line} - Tip: {res.error_tip}")

def test_indexerror_line_detection():
    code = """numbers = [1, 2, 3]
for i in range(10):
    val = numbers[i]
"""
    res = run_single_test_case(code, input_data="", expected_output="")
    assert res.passed is False
    assert res.status == "Error"
    assert res.error_line == 3
    assert res.error_type == "IndexError"
    assert "Line 3" in res.error_tip
    print(f"[PASS] IndexError line detection: Line {res.error_line} - Tip: {res.error_tip}")

def test_output_mismatch_tip():
    code = """
print("hello world")
"""
    res = run_single_test_case(code, input_data="", expected_output="HELLO WORLD")
    assert res.passed is False
    assert res.status == "Failed"
    assert res.error_type == "OutputMismatch"
    assert "Case Sensitivity Mismatch" in res.error_tip
    print(f"[PASS] OutputMismatch tip: {res.error_tip}")

if __name__ == "__main__":
    test_syntax_error_line_detection()
    test_zerodivision_line_detection()
    test_indexerror_line_detection()
    test_output_mismatch_tip()
    print("\nALL LINE DETECTION AND ERROR TIP TESTS PASSED!")
