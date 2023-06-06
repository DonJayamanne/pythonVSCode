import os
import pathlib

from .helpers import TEST_DATA_PATH, find_test_line_number

# This file contains the expected output dictionaries for tests discovery and is used in test_discovery.py.

# This is the expected output for the empty_discovery.py file.
# └──
TEST_DATA_PATH_STR = os.fspath(TEST_DATA_PATH)
empty_discovery_pytest_expected_output = {
    "name": ".data",
    "path": TEST_DATA_PATH_STR,
    "type_": "folder",
    "children": [],
    "id_": TEST_DATA_PATH_STR,
}

# This is the expected output for the simple_pytest.py file.
# └── simple_pytest.py
#    └── test_function
simple_test_file_path = os.fspath(TEST_DATA_PATH / "simple_pytest.py")
simple_discovery_pytest_expected_output = {
    "name": ".data",
    "path": TEST_DATA_PATH_STR,
    "type_": "folder",
    "children": [
        {
            "name": "simple_pytest.py",
            "path": simple_test_file_path,
            "type_": "file",
            "id_": simple_test_file_path,
            "children": [
                {
                    "name": "test_function",
                    "path": simple_test_file_path,
                    "lineno": find_test_line_number(
                        "test_function",
                        simple_test_file_path,
                    ),
                    "type_": "test",
                    "id_": "simple_pytest.py::test_function",
                    "runID": "simple_pytest.py::test_function",
                }
            ],
        }
    ],
    "id_": TEST_DATA_PATH_STR,
}

# This is the expected output for the unittest_pytest_same_file.py file.
# ├── unittest_pytest_same_file.py
#   ├── TestExample
#   │   └── test_true_unittest
#   └── test_true_pytest
unit_pytest_same_file_path = os.fspath(TEST_DATA_PATH / "unittest_pytest_same_file.py")
unit_pytest_same_file_discovery_expected_output = {
    "name": ".data",
    "path": TEST_DATA_PATH_STR,
    "type_": "folder",
    "children": [
        {
            "name": "unittest_pytest_same_file.py",
            "path": unit_pytest_same_file_path,
            "type_": "file",
            "id_": unit_pytest_same_file_path,
            "children": [
                {
                    "name": "TestExample",
                    "path": unit_pytest_same_file_path,
                    "type_": "class",
                    "children": [
                        {
                            "name": "test_true_unittest",
                            "path": unit_pytest_same_file_path,
                            "lineno": find_test_line_number(
                                "test_true_unittest",
                                unit_pytest_same_file_path,
                            ),
                            "type_": "test",
                            "id_": "unittest_pytest_same_file.py::TestExample::test_true_unittest",
                            "runID": "unittest_pytest_same_file.py::TestExample::test_true_unittest",
                        }
                    ],
                    "id_": "unittest_pytest_same_file.py::TestExample",
                },
                {
                    "name": "test_true_pytest",
                    "path": unit_pytest_same_file_path,
                    "lineno": find_test_line_number(
                        "test_true_pytest",
                        unit_pytest_same_file_path,
                    ),
                    "type_": "test",
                    "id_": "unittest_pytest_same_file.py::test_true_pytest",
                    "runID": "unittest_pytest_same_file.py::test_true_pytest",
                },
            ],
        }
    ],
    "id_": TEST_DATA_PATH_STR,
}

# This is the expected output for the unittest_folder tests
# └── unittest_folder
#    ├── test_add.py
#    │   └── TestAddFunction
#    │       ├── test_add_negative_numbers
#    │       └── test_add_positive_numbers
#    └── test_subtract.py
#        └── TestSubtractFunction
#            ├── test_subtract_negative_numbers
#            └── test_subtract_positive_numbers
unittest_folder_path = os.fspath(TEST_DATA_PATH / "unittest_folder")
test_add_path = os.fspath(TEST_DATA_PATH / "unittest_folder" / "test_add.py")
test_subtract_path = os.fspath(TEST_DATA_PATH / "unittest_folder" / "test_subtract.py")
unittest_folder_discovery_expected_output = {
    "name": ".data",
    "path": TEST_DATA_PATH_STR,
    "type_": "folder",
    "children": [
        {
            "name": "unittest_folder",
            "path": unittest_folder_path,
            "type_": "folder",
            "id_": unittest_folder_path,
            "children": [
                {
                    "name": "test_add.py",
                    "path": test_add_path,
                    "type_": "file",
                    "id_": test_add_path,
                    "children": [
                        {
                            "name": "TestAddFunction",
                            "path": test_add_path,
                            "type_": "class",
                            "children": [
                                {
                                    "name": "test_add_negative_numbers",
                                    "path": test_add_path,
                                    "lineno": find_test_line_number(
                                        "test_add_negative_numbers",
                                        test_add_path,
                                    ),
                                    "type_": "test",
                                    "id_": "unittest_folder/test_add.py::TestAddFunction::test_add_negative_numbers",
                                    "runID": "unittest_folder/test_add.py::TestAddFunction::test_add_negative_numbers",
                                },
                                {
                                    "name": "test_add_positive_numbers",
                                    "path": test_add_path,
                                    "lineno": find_test_line_number(
                                        "test_add_positive_numbers",
                                        test_add_path,
                                    ),
                                    "type_": "test",
                                    "id_": "unittest_folder/test_add.py::TestAddFunction::test_add_positive_numbers",
                                    "runID": "unittest_folder/test_add.py::TestAddFunction::test_add_positive_numbers",
                                },
                            ],
                            "id_": "unittest_folder/test_add.py::TestAddFunction",
                        }
                    ],
                },
                {
                    "name": "test_subtract.py",
                    "path": test_subtract_path,
                    "type_": "file",
                    "id_": test_subtract_path,
                    "children": [
                        {
                            "name": "TestSubtractFunction",
                            "path": test_subtract_path,
                            "type_": "class",
                            "children": [
                                {
                                    "name": "test_subtract_negative_numbers",
                                    "path": test_subtract_path,
                                    "lineno": find_test_line_number(
                                        "test_subtract_negative_numbers",
                                        test_subtract_path,
                                    ),
                                    "type_": "test",
                                    "id_": "unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_negative_numbers",
                                    "runID": "unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_negative_numbers",
                                },
                                {
                                    "name": "test_subtract_positive_numbers",
                                    "path": test_subtract_path,
                                    "lineno": find_test_line_number(
                                        "test_subtract_positive_numbers",
                                        test_subtract_path,
                                    ),
                                    "type_": "test",
                                    "id_": "unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_positive_numbers",
                                    "runID": "unittest_folder/test_subtract.py::TestSubtractFunction::test_subtract_positive_numbers",
                                },
                            ],
                            "id_": "unittest_folder/test_subtract.py::TestSubtractFunction",
                        }
                    ],
                },
            ],
        }
    ],
    "id_": TEST_DATA_PATH_STR,
}

# This is the expected output for the dual_level_nested_folder tests
#  └── dual_level_nested_folder
#    └── test_top_folder.py
#       └── test_top_function_t
#       └── test_top_function_f
#    └── nested_folder_one
#       └── test_bottom_folder.py
#          └── test_bottom_function_t
#          └── test_bottom_function_f
dual_level_nested_folder_path = os.fspath(TEST_DATA_PATH / "dual_level_nested_folder")
test_top_folder_path = os.fspath(
    TEST_DATA_PATH / "dual_level_nested_folder" / "test_top_folder.py"
)
test_nested_folder_one_path = os.fspath(
    TEST_DATA_PATH / "dual_level_nested_folder" / "nested_folder_one"
)
test_bottom_folder_path = os.fspath(
    TEST_DATA_PATH
    / "dual_level_nested_folder"
    / "nested_folder_one"
    / "test_bottom_folder.py"
)

dual_level_nested_folder_expected_output = {
    "name": ".data",
    "path": TEST_DATA_PATH_STR,
    "type_": "folder",
    "children": [
        {
            "name": "dual_level_nested_folder",
            "path": dual_level_nested_folder_path,
            "type_": "folder",
            "id_": dual_level_nested_folder_path,
            "children": [
                {
                    "name": "test_top_folder.py",
                    "path": test_top_folder_path,
                    "type_": "file",
                    "id_": test_top_folder_path,
                    "children": [
                        {
                            "name": "test_top_function_t",
                            "path": test_top_folder_path,
                            "lineno": find_test_line_number(
                                "test_top_function_t",
                                test_top_folder_path,
                            ),
                            "type_": "test",
                            "id_": "dual_level_nested_folder/test_top_folder.py::test_top_function_t",
                            "runID": "dual_level_nested_folder/test_top_folder.py::test_top_function_t",
                        },
                        {
                            "name": "test_top_function_f",
                            "path": test_top_folder_path,
                            "lineno": find_test_line_number(
                                "test_top_function_f",
                                test_top_folder_path,
                            ),
                            "type_": "test",
                            "id_": "dual_level_nested_folder/test_top_folder.py::test_top_function_f",
                            "runID": "dual_level_nested_folder/test_top_folder.py::test_top_function_f",
                        },
                    ],
                },
                {
                    "name": "nested_folder_one",
                    "path": test_nested_folder_one_path,
                    "type_": "folder",
                    "id_": test_nested_folder_one_path,
                    "children": [
                        {
                            "name": "test_bottom_folder.py",
                            "path": test_bottom_folder_path,
                            "type_": "file",
                            "id_": test_bottom_folder_path,
                            "children": [
                                {
                                    "name": "test_bottom_function_t",
                                    "path": test_bottom_folder_path,
                                    "lineno": find_test_line_number(
                                        "test_bottom_function_t",
                                        test_bottom_folder_path,
                                    ),
                                    "type_": "test",
                                    "id_": "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_t",
                                    "runID": "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_t",
                                },
                                {
                                    "name": "test_bottom_function_f",
                                    "path": test_bottom_folder_path,
                                    "lineno": find_test_line_number(
                                        "test_bottom_function_f",
                                        test_bottom_folder_path,
                                    ),
                                    "type_": "test",
                                    "id_": "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_f",
                                    "runID": "dual_level_nested_folder/nested_folder_one/test_bottom_folder.py::test_bottom_function_f",
                                },
                            ],
                        }
                    ],
                },
            ],
        }
    ],
    "id_": TEST_DATA_PATH_STR,
}

# This is the expected output for the double_nested_folder tests.
# └── double_nested_folder
#    └── nested_folder_one
#        └── nested_folder_two
#            └── test_nest.py
#                └── test_function
double_nested_folder_path = os.fspath(TEST_DATA_PATH / "double_nested_folder")
double_nested_folder_one_path = os.fspath(
    TEST_DATA_PATH / "double_nested_folder" / "nested_folder_one"
)
double_nested_folder_two_path = os.fspath(
    TEST_DATA_PATH / "double_nested_folder" / "nested_folder_one" / "nested_folder_two"
)
double_nested_test_nest_path = os.fspath(
    TEST_DATA_PATH
    / "double_nested_folder"
    / "nested_folder_one"
    / "nested_folder_two"
    / "test_nest.py"
)
double_nested_folder_expected_output = {
    "name": ".data",
    "path": TEST_DATA_PATH_STR,
    "type_": "folder",
    "children": [
        {
            "name": "double_nested_folder",
            "path": double_nested_folder_path,
            "type_": "folder",
            "id_": double_nested_folder_path,
            "children": [
                {
                    "name": "nested_folder_one",
                    "path": double_nested_folder_one_path,
                    "type_": "folder",
                    "id_": double_nested_folder_one_path,
                    "children": [
                        {
                            "name": "nested_folder_two",
                            "path": double_nested_folder_two_path,
                            "type_": "folder",
                            "id_": double_nested_folder_two_path,
                            "children": [
                                {
                                    "name": "test_nest.py",
                                    "path": double_nested_test_nest_path,
                                    "type_": "file",
                                    "id_": double_nested_test_nest_path,
                                    "children": [
                                        {
                                            "name": "test_function",
                                            "path": double_nested_test_nest_path,
                                            "lineno": find_test_line_number(
                                                "test_function",
                                                double_nested_test_nest_path,
                                            ),
                                            "type_": "test",
                                            "id_": "double_nested_folder/nested_folder_one/nested_folder_two/test_nest.py::test_function",
                                            "runID": "double_nested_folder/nested_folder_one/nested_folder_two/test_nest.py::test_function",
                                        }
                                    ],
                                }
                            ],
                        }
                    ],
                }
            ],
        }
    ],
    "id_": TEST_DATA_PATH_STR,
}

# This is the expected output for the nested_folder tests.
# └── parametrize_tests.py
#    └── test_adding[3+5-8]
#    └── test_adding[2+4-6]
#    └── test_adding[6+9-16]
parameterize_tests_path = os.fspath(TEST_DATA_PATH / "parametrize_tests.py")
parametrize_tests_expected_output = {
    "name": ".data",
    "path": TEST_DATA_PATH_STR,
    "type_": "folder",
    "children": [
        {
            "name": "parametrize_tests.py",
            "path": parameterize_tests_path,
            "type_": "file",
            "id_": parameterize_tests_path,
            "children": [
                {
                    "name": "test_adding[3+5-8]",
                    "path": parameterize_tests_path,
                    "lineno": find_test_line_number(
                        "test_adding[3+5-8]",
                        parameterize_tests_path,
                    ),
                    "type_": "test",
                    "id_": "parametrize_tests.py::test_adding[3+5-8]",
                    "runID": "parametrize_tests.py::test_adding[3+5-8]",
                },
                {
                    "name": "test_adding[2+4-6]",
                    "path": parameterize_tests_path,
                    "lineno": find_test_line_number(
                        "test_adding[2+4-6]",
                        parameterize_tests_path,
                    ),
                    "type_": "test",
                    "id_": "parametrize_tests.py::test_adding[2+4-6]",
                    "runID": "parametrize_tests.py::test_adding[2+4-6]",
                },
                {
                    "name": "test_adding[6+9-16]",
                    "path": parameterize_tests_path,
                    "lineno": find_test_line_number(
                        "test_adding[6+9-16]",
                        parameterize_tests_path,
                    ),
                    "type_": "test",
                    "id_": "parametrize_tests.py::test_adding[6+9-16]",
                    "runID": "parametrize_tests.py::test_adding[6+9-16]",
                },
            ],
        }
    ],
    "id_": TEST_DATA_PATH_STR,
}

# This is the expected output for the text_docstring.txt tests.
# └── text_docstring.txt
text_docstring_path = os.fspath(TEST_DATA_PATH / "text_docstring.txt")
doctest_pytest_expected_output = {
    "name": ".data",
    "path": TEST_DATA_PATH_STR,
    "type_": "folder",
    "children": [
        {
            "name": "text_docstring.txt",
            "path": text_docstring_path,
            "type_": "file",
            "id_": text_docstring_path,
            "children": [
                {
                    "name": "text_docstring.txt",
                    "path": text_docstring_path,
                    "lineno": find_test_line_number(
                        "text_docstring.txt",
                        text_docstring_path,
                    ),
                    "type_": "test",
                    "id_": "text_docstring.txt::text_docstring.txt",
                    "runID": "text_docstring.txt::text_docstring.txt",
                }
            ],
        }
    ],
    "id_": TEST_DATA_PATH_STR,
}
