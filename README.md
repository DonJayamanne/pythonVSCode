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
* Snippets

## Quick Start
* Install the extension
* If Python is in the current path
  + You're ready to use it.
* If using a custom Python Version or a Virtual Environment
  + Configure the path to the python executable in `python.pythonPath` of the `settings.json` file ([further details here](https://github.com/DonJayamanne/pythonVSCode/wiki/Python-Path-and-Version#python-version-used-for-intellisense-autocomplete-linting-formatting-etc)) 

## [Documentation](https://github.com/DonJayamanne/pythonVSCode/wiki)
For further information and details continue through to the [documentation](https://github.com/DonJayamanne/pythonVSCode/wiki).

## [Issues, Feature Requests and Contributions](https://github.com/DonJayamanne/pythonVSCode/issues)
* Contributions are always welcome. Fork it, modify it and create a pull request.
  + Details on contributing can be found [here](https://github.com/DonJayamanne/pythonVSCode/wiki/Contribution) 
* Any and all feedback is appreciated and welcome.
  + Please feel free to [add suggestions here](https://github.com/DonJayamanne/pythonVSCode/issues/183)

## [Roadmap](https://github.com/DonJayamanne/pythonVSCode/issues/183)
_Please note, not all of these feature may be developed.   
Your feedback is crucial in prioritizing the items and in determining whether we shift focus our attention to some other feature request(s)._    
* Intellisense and Linting
  + Context actions for some linter messages
  + Remote Interpretter
* Miscellaneous IDE enhancements
  + Auto-generate docstring
  + Documentation viewer
  + Improved integration of Unit Tests
  + Complex code refactoring (alogn with UI to preview)
* Integration
  + Code coverage
  + Profiler
  + Integrating IPython
* Debugging enhancements  
  + Integration with VS Code Terminal window
  + Securely debugging Python applications in the cloud (Azure, AWS or Google Cloud)
  + Remote debugging over SSH

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
 + Multiple Threads and Web Applications (such as Flask) (Windows and Mac)
 + Expanding values (viewing children, properties, etc) (Windows and Mac)
 + Conditional break points
 + Remote debugging
 + Google App Engine
* Unit Testing
 + Support for unittests, nosetests and pytest
 + Test results are displayed in the "Python" output window
* Snippets
* Refactoring
 + [Rename Refactorings](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Rename)
 + [Extract Variable Refactorings](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Variable)
 + [Extract Method Refactorings](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Method)
 + [Sort Imports](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Sort-Imports)

![Image of Generate Features](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/general.gif)

![Image of Debugging](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/standardDebugging.gif)

## [Change Log](https://github.com/DonJayamanne/pythonVSCode/releases)

### [Current Version 0.3.19](https://github.com/DonJayamanne/pythonVSCode/releases/tag/0.3.19)
* Sharing python.pythonPath value with debug configuration [#214](https://github.com/DonJayamanne/pythonVSCode/issues/214) and [#183](https://github.com/DonJayamanne/pythonVSCode/issues/183)
* Support extract variable and method refactoring [#220](https://github.com/DonJayamanne/pythonVSCode/issues/220)
* Support environment variables in settings [#148](https://github.com/DonJayamanne/pythonVSCode/issues/148)
* Support formatting of selected text [#197](https://github.com/DonJayamanne/pythonVSCode/issues/197) and [#183](https://github.com/DonJayamanne/pythonVSCode/issues/183)
* Support autocompletion of parameters [#71](https://github.com/DonJayamanne/pythonVSCode/issues/71)
* Support launching terminal (for debugging console apps) on Linux [#152](https://github.com/DonJayamanne/pythonVSCode/issues/152)
* Display name of linter along with diagnostic messages [#199](https://github.com/DonJayamanne/pythonVSCode/issues/199)
* Auto indenting of except and async functions [#205](https://github.com/DonJayamanne/pythonVSCode/issues/205) and [#215](https://github.com/DonJayamanne/pythonVSCode/issues/215)
* Support changes to pythonPath without having to restart VS Code [#216](https://github.com/DonJayamanne/pythonVSCode/issues/216)
* Resolved issue to support large debug outputs [#52](https://github.com/DonJayamanne/pythonVSCode/issues/52) and  [#52](https://github.com/DonJayamanne/pythonVSCode/issues/203)
* Handling instances when debugging with invalid paths to the python interpreter [#229](https://github.com/DonJayamanne/pythonVSCode/issues/229)

## Source

[GitHub](https://github.com/DonJayamanne/pythonVSCode)

                
## License

[MIT](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/LICENSE)
