-- ============================================================================
-- CODE MASTERS ROUND 2 - DEVELOPMENT ONLY SEED SCRIPT
-- DO NOT EXECUTE IN PRODUCTION
-- This script provides sample Python debugging questions and test cases for
-- local testing and verification only.
-- ============================================================================

-- Sample Question 1: Matrix Diagonal Sum Bug
INSERT INTO round2_questions (
    id,
    question_number,
    title,
    problem_statement,
    description,
    difficulty,
    language,
    starter_code,
    buggy_code,
    marks,
    time_limit_seconds,
    memory_limit_mb,
    is_active
) VALUES (
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    1,
    'Matrix Primary and Secondary Diagonal Sum',
    'Given a square matrix of size N x N, calculate the sum of the primary diagonal and secondary diagonal elements. If an element belongs to both diagonals (the center element in an odd-sized matrix), count it only once.',
    'Input Format:
The first line contains an integer N representing the size of the square matrix.
The next N lines contain N space-separated integers representing the matrix rows.

Output Format:
Print a single integer representing the total sum of diagonals without double-counting the center element.

Constraints:
1 <= N <= 100
-1000 <= Matrix[i][j] <= 1000',
    'Medium',
    'python',
    'def diagonal_sum(n, matrix):
    # TODO: Implement fix
    pass

if __name__ == "__main__":
    import sys
    lines = sys.stdin.read().split()
    if not lines:
        sys.exit(0)
    n = int(lines[0])
    idx = 1
    matrix = []
    for _ in range(n):
        matrix.append([int(lines[idx + j]) for j in range(n)])
        idx += n
    print(diagonal_sum(n, matrix))',
    'def diagonal_sum(n, matrix):
    total = 0
    # BUG: Double counts the center element and miscalculates secondary diagonal
    for i in range(n):
        total += matrix[i][i]
        total += matrix[i][n - i] # Bug: index out of bounds when i = 0
    return total

if __name__ == "__main__":
    import sys
    lines = sys.stdin.read().split()
    if not lines:
        sys.exit(0)
    n = int(lines[0])
    idx = 1
    matrix = []
    for _ in range(n):
        matrix.append([int(lines[idx + j]) for j in range(n)])
        idx += n
    print(diagonal_sum(n, matrix))',
    100,
    3.0,
    128,
    TRUE
) ON CONFLICT (question_number) DO NOTHING;

-- Test Cases for Sample Question 1
-- Public Case 1
INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '3
1 2 3
4 5 6
7 8 9',
    '25',
    FALSE,
    25,
    1
) ON CONFLICT DO NOTHING;

-- Public Case 2
INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '4
1 1 1 1
1 1 1 1
1 1 1 1
1 1 1 1',
    '8',
    FALSE,
    25,
    2
) ON CONFLICT DO NOTHING;

-- Hidden Case 3
INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'd4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '1
42',
    '42',
    TRUE,
    25,
    3
) ON CONFLICT DO NOTHING;

-- Hidden Case 4
INSERT INTO round2_test_cases (id, question_id, input_data, expected_output, is_hidden, marks, order_index)
VALUES (
    'e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b',
    'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    '3
5 -2 3
0 10 0
1 4 -6',
    '12',
    TRUE,
    25,
    4
) ON CONFLICT DO NOTHING;
