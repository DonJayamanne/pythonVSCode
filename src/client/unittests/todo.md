**Code Lens for unit tests**
- When a file is opened, check if it is a unit test file
- If it is a unittest file, then display codelens for each unit test classes and methods
- **Question - How do we update code lenses?**
Do we use the vscode.executeCodeLensProvider? (complex commands)
- Add methods such as:
    + Run this test
    + View Result(details) of previous Run
    + Debug this test (last - low priority)
        + First (programatically) add breakpoint to the first line of code in this method
        + Next launch the debugger using the debugger api

[ ] Todo: **How to refresh the codelens (text) use vscode.executeCodeLensProvider?**

**Code Lens for standard files**
- When a file is opened, check if it is a unit test file
- If it is not a unittest file, then identify all methods/functions in this file
- Check if any of those methods/functions are used any of the unit tests
- **However we don't know whether this function/method caused the test to fail.**
    **or do we, this depends on what information we can extract form the traceback.**

**Status Bar**
- Add command for satusbar:
<<<<<<< a9df1f18b91727c5d1f6a21f5587baa36f04d781
<<<<<<< b0927e0baf2e1c2fd0cc96b48ae637343410c4b2:src/client/unittests/todo.md
=======
>>>>>>> more changes to unittests #239
    + In the pick list of functions, if a function is selected:
        + View test result for selected function
        + Debug function
        + Run test function
        + Navigate to that test function
<<<<<<< a9df1f18b91727c5d1f6a21f5587baa36f04d781

=======
    + Run all tests
    + Run failed tests
    + Run previous tests
    + Run specific test
        + This displays a picklist of tests (user can filter and select)
        (again low priority)
>>>>>>> support python unittest framework #239:src/client/unittests/todo.md
=======
>>>>>>> more changes to unittests #239
