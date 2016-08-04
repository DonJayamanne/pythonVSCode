
**Collect and store**
- Collect list of unit tests and store in workspace state
- Collect test results and store in workspace state

[ ] Todo: Store the tests and the results in workspace store
[ ] Todo: Provide api to store this (simple class with shared methods/props? yuck)
[ ] Todo: Provide api to access this

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

[ ] Todo: Api to determine if a file is a UnitTest file
[ ] Todo: **How to refresh the codelens (text) use vscode.executeCodeLensProvider?**

**Code Lens for standard files**
- When a file is opened, check if it is a unit test file
- If it is not a unittest file, then identify all methods/functions in this file
- Check if any of those methods/functions are used any of the unit tests
- **However we don't know whether this function/method caused the test to fail.**
    **or do we, this depends on what information we can extract form the traceback.**

**Status Bar**
- Display test results (pass and fail count)
- Add command for satusbar:
    + Run all tests
    + Run failed tests
    + Run previous tests
    + Run specific test
        + This displays a picklist of tests (user can filter and select)
        (again low priority)

