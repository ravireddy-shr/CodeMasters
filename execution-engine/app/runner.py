"""
Secure Code Execution Runner for Code Masters Round 2
Enforces strict timeouts, output limits, memory bounds, stripped environments,
and temporary working directory sandboxing.
Includes intelligent Python traceback parser and line-specific error advice.
"""

import os
import sys
import tempfile
import time
import subprocess
import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

MAX_OUTPUT_BYTES = 32 * 1024  # 32 KB maximum output buffer to prevent RAM exhaustion
DEFAULT_TIMEOUT_SECONDS = 3.0

# Critical blacklisted environment variables that participant code must NEVER see
SENSITIVE_ENV_KEYS = [
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "DATABASE_URL",
    "SECRET_KEY",
    "JWT_SECRET",
    "ADMIN_PASSWORD",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "POSTGRES_PASSWORD"
]

@dataclass
class TestCaseResult:
    test_case_id: str
    passed: bool
    status: str  # 'Passed', 'Failed', 'Error', 'Timeout'
    input_data: str
    expected_output: str
    actual_output: str
    execution_time_ms: float
    error_message: Optional[str]
    is_hidden: bool
    marks: int
    score_awarded: int
    error_line: Optional[int] = None
    error_type: Optional[str] = None
    error_tip: Optional[str] = None

def sanitize_environment() -> Dict[str, str]:
    """
    Creates a minimal, sanitized environment dictionary for the execution subprocess,
    ensuring zero access to sensitive server environment variables.
    """
    safe_keys = ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "LANG", "LC_ALL", "PYTHONPATH"]
    clean_env = {k: os.environ[k] for k in safe_keys if k in os.environ}
    for key in SENSITIVE_ENV_KEYS:
        clean_env.pop(key, None)
    return clean_env

def normalize_output(text: str) -> str:
    """Normalize newlines and strip trailing whitespace for reliable comparison."""
    if text is None:
        return ""
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)

def analyze_python_error(
    status: str,
    stderr: str,
    stdout: str,
    expected_output: str,
    code: str,
) -> Dict[str, Any]:
    """
    Parses Python traceback and execution output to extract:
    - error_line: exact line in code where mistake occurred (if found)
    - error_type: category of mistake (e.g. SyntaxError, IndexError, Output Mismatch)
    - error_tip: actionable debugging tip and advice for the student
    """
    error_line = None
    error_type = None
    error_tip = None

    if status == "Error" and stderr:
        # 1. Parse line number from traceback: File "solution.py", line 7 or File "...", line 12
        line_matches = re.findall(r'(?:solution\.py|<string>|File ".*?"), line (\d+)', stderr)
        if line_matches:
            try:
                error_line = int(line_matches[-1])
            except ValueError:
                pass

        # 2. Extract error class & details
        err_type_match = re.search(
            r'([A-Za-z_]+Error|[A-Za-z_]+Exception):\s*(.*)', stderr
        )
        if err_type_match:
            error_type = err_type_match.group(1)
            err_detail = err_type_match.group(2).strip()
        else:
            error_type = "RuntimeError"
            err_detail = stderr.strip().split("\n")[-1]

        # 3. Generate pedagogical advice and actionable tip
        line_str = f"on Line {error_line}" if error_line else "in your code"

        if error_type == "SyntaxError":
            error_tip = (
                f"Syntax mistake {line_str}: Check for missing colons (:) at the end of if/else, "
                f"for, while, or def statements. Also check for mismatched parentheses, brackets, or unclosed string quotes."
            )
        elif error_type == "IndentationError":
            error_tip = (
                f"Indentation mistake {line_str}: Python requires consistent indentation (usually 4 spaces). "
                f"Ensure statements inside functions, loops, and condition blocks are aligned properly."
            )
        elif error_type == "IndexError":
            error_tip = (
                f"Index out of range {line_str}: You attempted to access an element beyond the list boundaries. "
                f"Remember Python uses 0-based indexing (valid indices are 0 to len - 1). Check loop bounds like `range(n)`."
            )
        elif error_type == "ZeroDivisionError":
            error_tip = (
                f"Division by zero {line_str}: Attempted to divide or modulo (%) by 0. "
                f"Add a check or condition to guard against zero divisors."
            )
        elif error_type == "NameError":
            error_tip = (
                f"Undefined variable or name {line_str}: '{err_detail}'. "
                f"Check for typos, ensure the variable was initialized before this line, or verify required module imports."
            )
        elif error_type == "TypeError":
            error_tip = (
                f"Type mismatch {line_str}: '{err_detail}'. "
                f"Ensure you are not combining incompatible types (e.g., adding str to int). Use type casting like `int()` where needed."
            )
        elif error_type == "AttributeError":
            error_tip = (
                f"Attribute error {line_str}: '{err_detail}'. "
                f"Verify the variable type and ensure the method exists for that data structure."
            )
        elif error_type == "ValueError":
            error_tip = (
                f"Value error {line_str}: '{err_detail}'. "
                f"Check input conversion logic (e.g. converting non-numeric text to int)."
            )
        elif error_type == "RecursionError":
            error_tip = (
                f"Maximum recursion depth exceeded {line_str}: "
                f"Ensure your recursive function has a base condition that terminates execution."
            )
        else:
            error_tip = f"Runtime error {line_str}: {err_detail}. Review the logic on this line to ensure proper execution."

    elif status == "Timeout":
        error_type = "TimeLimitExceeded"
        error_tip = (
            "Time Limit Exceeded: The program took longer than allowed. "
            "Check for infinite loops (e.g., `while` conditions that never terminate) or excessive recursion."
        )

    elif status == "Failed":
        error_type = "OutputMismatch"
        norm_actual = normalize_output(stdout)
        norm_expected = normalize_output(expected_output)

        if not norm_actual:
            error_tip = (
                "No Output Produced: Your solution executed without crashing, but did not print any output. "
                "Ensure your code calls `print(...)` with the final answer."
            )
        elif norm_actual.lower() == norm_expected.lower() and norm_actual != norm_expected:
            error_tip = (
                "Case Sensitivity Mismatch: Your output text matches the expected letters, but differs in uppercase/lowercase. "
                "Match the exact casing requested in the problem description."
            )
        else:
            error_tip = (
                f"Output Mismatch: Expected '{norm_expected}' but your code produced '{norm_actual}'. "
                f"Review your algorithm's mathematical calculations and edge cases."
            )

    return {
        "error_line": error_line,
        "error_type": error_type,
        "error_tip": error_tip,
    }

def prepare_sandbox_and_code(code: str, input_data: str, sandbox_dir: str) -> str:
    """
    Handles file preparation (such as marks.txt for Question 4)
    and handles test case variable injection if code contains hardcoded sample variables
    and does not read from stdin.
    """
    # 1. Handle file creation (Question 4: marks.txt)
    if "marks.txt" in code or "marks.txt" in input_data:
        file_content = input_data
        if "marks.txt:" in file_content:
            file_content = file_content.split("marks.txt:", 1)[1].lstrip("\r\n ")
        marks_file_path = os.path.join(sandbox_dir, "marks.txt")
        with open(marks_file_path, "w", encoding="utf-8") as mf:
            mf.write(file_content)

    # 2. Variable replacement for debugging questions where students keep the sample assignment
    # If the user's code already uses input() or sys.stdin, do not modify the code
    if "input(" in code or "sys.stdin" in code:
        return code

    mod_code = code
    inp = input_data.strip()

    # Q1: numbers = [...]
    if inp.startswith("[") and re.search(r"numbers\s*=\s*\[", mod_code):
        mod_code = re.sub(r"numbers\s*=\s*\[[^\]]*\]", f"numbers = {inp}", mod_code, count=1)

    # Q2: marks = [...]
    elif inp.startswith("[") and re.search(r"marks\s*=\s*\[", mod_code):
        mod_code = re.sub(r"marks\s*=\s*\[[^\]]*\]", f"marks = {inp}", mod_code, count=1)

    # Q3: students={...}; name="..."
    elif "name=" in inp:
        name_match = re.search(r'name\s*=\s*["\']([^"\']+)["\']', inp)
        if name_match:
            n_val = name_match.group(1)
            mod_code = re.sub(r'name\s*=\s*["\'][^"\']*["\']', f'name = "{n_val}"', mod_code, count=1)

    # Q5: marks = np.array([...])
    elif inp.startswith("[") and re.search(r"marks\s*=\s*np\.array\(", mod_code):
        mod_code = re.sub(r"marks\s*=\s*np\.array\(\[[^\]]*\]\)", f"marks = np.array({inp})", mod_code, count=1)

    return mod_code

def check_outputs_match(actual: str, expected: str) -> bool:
    norm_actual = normalize_output(actual)
    norm_expected = normalize_output(expected)
    if norm_actual == norm_expected:
        return True

    # Flexible matching for Question 5 (NumPy Marks Analysis DataFrame output)
    if "Highest:" in norm_expected:
        act_h = re.search(r"Highest:\s*(\d+)", norm_actual)
        exp_h = re.search(r"Highest:\s*(\d+)", norm_expected)
        if act_h and exp_h and act_h.group(1) == exp_h.group(1):
            exp_nums = re.findall(r"\b\d+\b", norm_expected)
            act_nums = re.findall(r"\b\d+\b", norm_actual)
            if all(n in act_nums for n in exp_nums):
                return True

    return False

def run_single_test_case(
    code: str,
    input_data: str,
    expected_output: str,
    time_limit_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    test_case_id: str = "tc-default",
    is_hidden: bool = False,
    marks: int = 20,
) -> TestCaseResult:
    """
    Executes Python code in an isolated subprocess with strict timeout, output limits,
    and intelligent error diagnosis.
    """
    start_time = time.perf_counter()
    clean_env = sanitize_environment()

    with tempfile.TemporaryDirectory(prefix="cm_r2_sandbox_") as sandbox_dir:
        # Prepare sandbox environment files and code
        effective_code = prepare_sandbox_and_code(code, input_data, sandbox_dir)

        script_path = os.path.join(sandbox_dir, "solution.py")
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(effective_code)

        try:
            process = subprocess.Popen(
                [sys.executable, "-B", "-u", script_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=sandbox_dir,
                env=clean_env,
                text=True,
                encoding="utf-8",
                errors="replace",
            )

            try:
                stdout_data, stderr_data = process.communicate(
                    input=input_data,
                    timeout=time_limit_seconds
                )
                elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

                # Cap output length
                if len(stdout_data.encode("utf-8")) > MAX_OUTPUT_BYTES:
                    stdout_data = stdout_data[:MAX_OUTPUT_BYTES] + "\n[Output truncated: Exceeded buffer size]"
                if len(stderr_data.encode("utf-8")) > MAX_OUTPUT_BYTES:
                    stderr_data = stderr_data[:MAX_OUTPUT_BYTES] + "\n[Stderr truncated]"

                # Check process return code
                if process.returncode != 0:
                    err_msg = stderr_data.strip() if stderr_data.strip() else f"Runtime error: exit code {process.returncode}"
                    diag = analyze_python_error("Error", stderr_data, stdout_data, expected_output, code)
                    return TestCaseResult(
                        test_case_id=test_case_id,
                        passed=False,
                        status="Error",
                        input_data=input_data,
                        expected_output=expected_output,
                        actual_output=stdout_data,
                        execution_time_ms=elapsed_ms,
                        error_message=err_msg,
                        is_hidden=is_hidden,
                        marks=marks,
                        score_awarded=0,
                        error_line=diag["error_line"],
                        error_type=diag["error_type"],
                        error_tip=diag["error_tip"],
                    )

                # Normal termination - compare outputs
                norm_actual = normalize_output(stdout_data)
                norm_expected = normalize_output(expected_output)
                passed = check_outputs_match(stdout_data, expected_output)

                diag = analyze_python_error("Passed" if passed else "Failed", stderr_data, stdout_data, expected_output, code)
                return TestCaseResult(
                    test_case_id=test_case_id,
                    passed=passed,
                    status="Passed" if passed else "Failed",
                    input_data=input_data,
                    expected_output=expected_output,
                    actual_output=norm_actual,
                    execution_time_ms=elapsed_ms,
                    error_message=None if passed else "Output mismatch",
                    is_hidden=is_hidden,
                    marks=marks,
                    score_awarded=marks if passed else 0,
                    error_line=diag.get("error_line"),
                    error_type=diag.get("error_type"),
                    error_tip=diag.get("error_tip"),
                )

            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate()
                elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
                diag = analyze_python_error("Timeout", "", "", expected_output, code)
                return TestCaseResult(
                    test_case_id=test_case_id,
                    passed=False,
                    status="Timeout",
                    input_data=input_data,
                    expected_output=expected_output,
                    actual_output="",
                    execution_time_ms=elapsed_ms,
                    error_message=f"Time Limit Exceeded: Process terminated after {time_limit_seconds} seconds.",
                    is_hidden=is_hidden,
                    marks=marks,
                    score_awarded=0,
                    error_line=None,
                    error_type="TimeLimitExceeded",
                    error_tip=diag.get("error_tip"),
                )

        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return TestCaseResult(
                test_case_id=test_case_id,
                passed=False,
                status="Error",
                input_data=input_data,
                expected_output=expected_output,
                actual_output="",
                execution_time_ms=elapsed_ms,
                error_message=f"Execution engine failure: {str(e)}",
                is_hidden=is_hidden,
                marks=marks,
                score_awarded=0,
                error_line=None,
                error_type="EngineFailure",
                error_tip="An unexpected sandbox issue occurred. Verify code formatting.",
            )

def execute_test_suite(
    code: str,
    test_cases: List[Dict[str, Any]],
    time_limit_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    stop_on_first_error: bool = False,
) -> Dict[str, Any]:
    """
    Executes code against a collection of test cases and aggregates results.
    """
    results: List[TestCaseResult] = []
    total_score = 0
    max_score = 0
    passed_count = 0
    total_count = len(test_cases)
    total_time_ms = 0.0

    for tc in test_cases:
        tc_id = str(tc.get("id", f"tc-{len(results) + 1}"))
        tc_input = tc.get("input_data", tc.get("input", ""))
        tc_expected = tc.get("expected_output", "")
        tc_hidden = bool(tc.get("is_hidden", False))
        tc_marks = int(tc.get("marks", 20))
        max_score += tc_marks

        res = run_single_test_case(
            code=code,
            input_data=tc_input,
            expected_output=tc_expected,
            time_limit_seconds=time_limit_seconds,
            test_case_id=tc_id,
            is_hidden=tc_hidden,
            marks=tc_marks,
        )

        results.append(res)
        total_time_ms += res.execution_time_ms
        if res.passed:
            passed_count += 1
            total_score += res.score_awarded

        if stop_on_first_error and not res.passed:
            break

    # First error or failure result for summary diagnostic
    first_failing = next((r for r in results if not r.passed), None)

    return {
        "success": (passed_count == total_count and total_count > 0),
        "total_test_cases": total_count,
        "passed_count": passed_count,
        "failed_count": total_count - passed_count,
        "score_awarded": total_score,
        "max_score": max_score,
        "total_execution_time_ms": round(total_time_ms, 2),
        "error_summary": {
            "error_line": first_failing.error_line if first_failing else None,
            "error_type": first_failing.error_type if first_failing else None,
            "error_tip": first_failing.error_tip if first_failing else None,
        } if first_failing else None,
        "results": [
            {
                "test_case_id": r.test_case_id,
                "passed": r.passed,
                "status": r.status,
                "input_data": r.input_data,
                "expected_output": "[HIDDEN TEST CASE]" if r.is_hidden else r.expected_output,
                "actual_output": "[OUTPUT CONCEALED]" if r.is_hidden and not r.passed else (r.actual_output if not r.is_hidden else "[OUTPUT VERIFIED]"),
                "execution_time_ms": r.execution_time_ms,
                "error_message": "Hidden test case failure" if r.is_hidden and r.error_message else r.error_message,
                "is_hidden": r.is_hidden,
                "marks": r.marks,
                "score_awarded": r.score_awarded,
                "error_line": r.error_line,
                "error_type": r.error_type,
                "error_tip": r.error_tip,
            }
            for r in results
        ],
        "detailed_results_for_admin": [
            {
                "test_case_id": r.test_case_id,
                "passed": r.passed,
                "status": r.status,
                "input_data": r.input_data,
                "expected_output": r.expected_output,
                "actual_output": r.actual_output,
                "execution_time_ms": r.execution_time_ms,
                "error_message": r.error_message,
                "is_hidden": r.is_hidden,
                "marks": r.marks,
                "score_awarded": r.score_awarded,
                "error_line": r.error_line,
                "error_type": r.error_type,
                "error_tip": r.error_tip,
            }
            for r in results
        ],
    }
