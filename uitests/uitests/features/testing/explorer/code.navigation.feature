@test
@https://github.com/DonJayamanne/pyvscSmokeTesting.git
Feature: Test Explorer Discovering icons and stop discovery
    Scenario: When navigating to a test file, suite & test, then open the file and set the cursor at the right line (unitest)
        Given the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is enabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        And the command "View: Close All Editors" is selected
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        When I navigate to the code associated with test node "test_one.py"
        Then the file "test_one.py" is opened
        When I navigate to the code associated with test node "test_one_first_suite"
        Then the file "test_one.py" is opened
        And the cursor is on line 20
        When I navigate to the code associated with test node "test_three_first_suite"
        Then the file "test_one.py" is opened
        And the cursor is on line 30
        When I navigate to the code associated with test node "test_two_first_suite"
        Then the file "test_one.py" is opened
        And the cursor is on line 25

    Scenario: When navigating to a test file, suite & test, then open the file and set the cursor at the right line (pytest)
        Given the package "pytest" is installed
        And the workspace setting "python.testing.pyTestEnabled" is enabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        When I navigate to the code associated with test node "test_one.py"
        Then the file "test_one.py" is opened
        When I navigate to the code associated with test node "test_one_first_suite"
        Then the file "test_one.py" is opened
        And the cursor is on line 20
        When I navigate to the code associated with test node "test_three_first_suite"
        Then the file "test_one.py" is opened
        And the cursor is on line 30
        When I navigate to the code associated with test node "test_two_first_suite"
        Then the file "test_one.py" is opened
        And the cursor is on line 25

    Scenario: When navigating to a test file, suite & test, then open the file and set the cursor at the right line (nose)
        Given the package "nose" is installed
        And the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is enabled
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        When I navigate to the code associated with test node "tests/test_one.py"
        Then the file "test_one.py" is opened
        When I navigate to the code associated with test node "test_one_first_suite"
        Then the file "test_one.py" is opened
        And the cursor is on line 20
        When I navigate to the code associated with test node "test_three_first_suite"
        Then the file "test_one.py" is opened
        And the cursor is on line 30
        When I navigate to the code associated with test node "test_two_first_suite"
        Then the file "test_one.py" is opened
        And the cursor is on line 25


    Scenario: When selecting a node, then open the file (unitest)
        Given the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is enabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        And the command "View: Close All Editors" is selected
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        When I click node "TestFirstSuite"
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node "test_one_first_suite"
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node "test_three_first_suite"
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node "test_two_third_suite"
        Then the file "test_two.py" is opened


    Scenario: When selecting a node, then open the file (pytest)
        Given the package "pytest" is installed
        And the workspace setting "python.testing.pyTestEnabled" is enabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is disabled
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        When I click node "TestFirstSuite"
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node "test_one_first_suite"
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node "test_three_first_suite"
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node "test_two_third_suite"
        Then the file "test_two.py" is opened

    Scenario: When selecting a node, then open the file (nose)
        Given the package "nose" is installed
        And the workspace setting "python.testing.pyTestEnabled" is disabled
        And the workspace setting "python.testing.unittestEnabled" is disabled
        And the workspace setting "python.testing.nosetestsEnabled" is enabled
        When I reload VSC
        When I select the command "Python: Discover Tests"
        Then the test explorer icon will be visible
        When I select the command "View: Show Test"
        And I expand all of the test tree nodes
        When I click node "TestFirstSuite"
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node "test_one_first_suite"
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node "test_three_first_suite"
        Then the file "test_one.py" is opened
        Given the command "View: Close All Editors" is selected
        When I click node "test_two_third_suite"
        Then the file "test_two.py" is opened
