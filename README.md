# Python

An extension with rich support for the [Python language](https://www.python.org/), with features including the following and more:   
* Linting ([Prospector](https://pypi.io/project/prospector/), [Pylint](https://pypi.io/project/pylint/), [pycodestyle](https://pypi.io/project/pycodestyle/)/Pep8, [Flake8](https://pypi.io/project/flake8/), [pydocstyle](https://pypi.io/project/pydocstyle/) with config files and plugins)
* Intellisense (autocompletion)
* Auto indenting
* Code formatting ([autopep8](https://pypi.io/project/autopep8/), [yapf](https://pypi.io/project/yapf/), with config files)
* Code refactoring ([Rename](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Rename), [Extract Variable](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Variable), [Extract Method](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Method), [Sort Imports](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Sort-Imports))
* Renaming, Viewing references, and code navigation
* View signature and similar by hovering over a function or method
* Excellent debugging support (variables, arguments, expressions, watch window, stack information, break points, remote debugging, mutliple threads)
* Unit testing ([unittest](https://docs.python.org/3/library/unittest.html#module-unittest), [pytest](https://pypi.io/project/pytest/), [nosetests](https://pypi.io/project/nose/), with config files)
* Execute file or selected code in python terminal
* Snippets

## Quick Start
* Install the extension
* If Python is in the current path
  + You're ready to use it.
* If using a custom Python Version or a Virtual Environment, use the command [```Select Workspace Interpreter```](https://github.com/DonJayamanne/pythonVSCode/wiki/Miscellaneous#select-an-interpreter)) 

## [Documentation](https://github.com/DonJayamanne/pythonVSCode/wiki)
For further information and details continue through to the [documentation](https://github.com/DonJayamanne/pythonVSCode/wiki).

## [Issues, Feature Requests and Contributions](https://github.com/DonJayamanne/pythonVSCode/issues)
* Contributions are always welcome. Fork it, modify it and create a pull request.
  + Details on contributing can be found [here](https://github.com/DonJayamanne/pythonVSCode/wiki/Contribution) 
* Any and all feedback is appreciated and welcome.
  + Please feel free to [add suggestions here](https://github.com/DonJayamanne/pythonVSCode/issues/183)

## Feature Details
* IDE Features
 + Auto indenting
 + Code navigation (Go to, Find all references)
 + Code definition (Peek and hover definition, View Signature)
 + Rename refactoring
 + Sorting Import statements (use "Python: Sort Imports" command)
* [Intellisense and Autocomplete](https://github.com/DonJayamanne/pythonVSCode/wiki/Autocomplete-Intellisense)
 + Ability to include custom module paths (e.g. include paths for libraries like Google App Engine, etc.)
 + Use the `setting python.autoComplete.extraPaths = []`
 + For instance getting autocomplete/intellisense for Google App Engine, add the following to your settings file:
```json
"python.autoComplete.extraPaths": [
    "C:/Program Files (x86)/Google/google_appengine",
    "C:/Program Files (x86)/Google/google_appengine/lib" ]
```
* [Code formatting](https://github.com/DonJayamanne/pythonVSCode/wiki/Formatting)
 + Auto formatting of code upon saving changes (default to 'Off')
 + Use either yapf or autopep8 for code formatting (defaults to autopep8)
* [Linting](https://github.com/DonJayamanne/pythonVSCode/wiki/Linting)
 + It can be turned off (default is to be turned on and use pylint)
 + Multiple linters supported (along with support for configuration files for each linter)
 + Supported linters include pylit, pep8, flake8, pydocstyle, prospector
 + Paths to each of the linters can be optionally configured
 + Custom plugins such as pylint plugin for Django can be easily used by modifying the settings as follows:
```json
"python.linting.pylintArgs": ["--load-plugins", "pylint_django"]
``` 
* [Debugging](https://github.com/DonJayamanne/pythonVSCode/wiki/Debugging)
 + Watch window
 + Evaluate Expressions
 + Step through code (Step in, Step out, Continue)
 + Add/remove break points
 + Local variables and arguments
 + Multiple Threads and Web Applications (such as Flask, Django)
 + Expanding values (viewing children, properties, etc)
 + Conditional break points
 + Remote debugging
 + Google App Engine
 + Debugging in the integrated or external terminal window
 * Debugging as sudo
* [Unit Testing](https://github.com/DonJayamanne/pythonVSCode/wiki/UnitTests)
 + Support for unittests, nosetests and pytest
 + Test results are displayed in the "Python" output window
 + Run failed tests, individual tests
* Snippets
* Miscellaneous
 + Running a file or selected text in python terminal
* Refactoring
 + [Rename Refactorings](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Rename)
 + [Extract Variable Refactorings](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Variable)
 + [Extract Method Refactorings](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Method)
 + [Sort Imports](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Sort-Imports)

![Image of Generate Features](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/general.gif)

![Image of Debugging](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/standardDebugging.gif)

## [Roadmap](https://github.com/DonJayamanne/pythonVSCode/issues/183)
_Please note, not all of these feature may be developed.   
Your feedback is crucial in prioritizing the items and in determining whether we shift focus our attention to some other feature request(s)._    
* Intellisense and Linting
  + Remote Interpretter
* Miscellaneous IDE enhancements
  + Auto-generate docstring
  + Documentation viewer
  + Complex code refactoring (alogn with UI to preview)
  + Debugging unit tests
  + Intelliense (completions) within debugger
* Integration
  + Code coverage
  + Profiler
  + Integrating IPython
* Debugging enhancements  
  + Securely debugging Python applications in the cloud (Azure, AWS or Google Cloud)
  + Remote debugging over SSH

## [Change Log](https://github.com/DonJayamanne/pythonVSCode/releases)

### Current Version 0.3.24
* Added support for clearing cached tests [#307](https://github.com/DonJayamanne/pythonVSCode/issues/307)
* Added support for executing files in terminal with spaces in paths [#308](https://github.com/DonJayamanne/pythonVSCode/issues/308)
* Fix issue related to running unittests on Windows [#309](https://github.com/DonJayamanne/pythonVSCode/issues/309)
* Support custom environment variables when launching external terminal [#311](https://github.com/DonJayamanne/pythonVSCode/issues/311)

### Version 0.3.23
* Added support for the attribute supportsRunInTerminal attribute in debugger [#304](https://github.com/DonJayamanne/pythonVSCode/issues/304)
* Changes to ensure remote debugging resolves remote paths correctly [#302](https://github.com/DonJayamanne/pythonVSCode/issues/302)
* Added support for custom pytest and nosetest paths [#301](https://github.com/DonJayamanne/pythonVSCode/issues/301)
* Resolved issue in ```Watch``` window displaying ```<error:previous evaluation...``` [#301](https://github.com/DonJayamanne/pythonVSCode/issues/301)
* Reduce extension size by removing unwanted files [#296](https://github.com/DonJayamanne/pythonVSCode/issues/296)
* Updated code snippets

### Version 0.3.22
* Added few new snippets
* Integrated [Unit Tests](https://github.com/DonJayamanne/pythonVSCode/wiki/UnitTests)
* Selecting interpreter and updating ```settings.json```[Documentation]](https://github.com/DonJayamanne/pythonVSCode/wiki/Miscellaneous#select-an-interpreter), [#257](https://github.com/DonJayamanne/pythonVSCode/issues/257)
* Running a file or selection in terminal [Documentation](https://github.com/DonJayamanne/pythonVSCode/wiki/Miscellaneous#execute-in-python-terminal), [#261](https://github.com/DonJayamanne/pythonVSCode/wiki/Miscellaneous#execute-in-python-terminal) (new to [Visual Studio Code 1.5](https://code.visualstudio.com/Updates#_extension-authoring))
* Debugging an application using the integrated terminal window (new to [Visual Studio Code 1.5](https://code.visualstudio.com/Updates#_node-debugging))
* Running a python script without debugging [#118](https://github.com/DonJayamanne/pythonVSCode/issues/118)
* Displaying errors in variable explorer when debugging [#271](https://github.com/DonJayamanne/pythonVSCode/issues/271)
* Ability to debug applications as sudo [#224](https://github.com/DonJayamanne/pythonVSCode/issues/224)
* Fixed debugger crashes [#263](https://github.com/DonJayamanne/pythonVSCode/issues/263)
* Asynchronous display of unit tests [#190](https://github.com/DonJayamanne/pythonVSCode/issues/190)
* Fixed issues when using relative paths in ```settings.json``` [#276](https://github.com/DonJayamanne/pythonVSCode/issues/276)
* Fixes issue of hardcoding interpreter command arguments [#256](https://github.com/DonJayamanne/pythonVSCode/issues/256)
* Fixes resolving of remote paths when debugging remote applications [#252](https://github.com/DonJayamanne/pythonVSCode/issues/252)

## Thank you
- [James Booth](https://github.com/jabooth)
  + Selecting interpreter and updating ```settings.json``` [#257](https://github.com/DonJayamanne/pythonVSCode/issues/257)
  + Running a file or selection in terminal [#261](https://github.com/DonJayamanne/pythonVSCode/wiki/Miscellaneous#execute-in-python-terminal)
  + Asynchronous display of unit tests [#190](https://github.com/DonJayamanne/pythonVSCode/issues/190)
- [QIU Quan](https://github.com/jackqq)
  + Changes to ensure remote debugging resolves remote paths correctly [#302](https://github.com/DonJayamanne/pythonVSCode/issues/302)
    
## Source

[GitHub](https://github.com/DonJayamanne/pythonVSCode)

                
## License

[MIT](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/LICENSE)
