#Python   

An extension with rich support for the [Python language](https://www.python.org/), with features including the following and more:   
* Linting ([Prospector](https://pypi.io/project/prospector/), [Pylint](https://pypi.io/project/pylint/), [pycodestyle](https://pypi.io/project/pycodestyle/)/Pep8, [Flake8](https://pypi.io/project/flake8/), [pydocstyle](https://pypi.io/project/pydocstyle/) with config files and plugins)
* Intellisense (autocompletion)
* Auto indenting
* Code formatting ([autopep8](https://pypi.io/project/autopep8/), [yapf](https://pypi.io/project/yapf/), with config files)
* Renaming, Viewing references, and code navigation
* View signature and similar by hovering over a function or method
* Excellent debugging suppot (variables, arguments, expressions, watch window, stack information, break points, remote debugging, mutliple threads)
* Unit testing ([unittest](https://docs.python.org/3/library/unittest.html#module-unittest), [pytest](https://pypi.io/project/pytest/), [nosetests](https://pypi.io/project/nose/), with config files)
* Sorting imports
* Snippets

##Quick Start
* Install the extension
* If Python is in the current path
  + You're ready to use it.
* If using a custom Python Version or a Virtual Environment
  + Configure the path to the python executable in `python.pythonPath` of the `settings.json` file ([further details here](https://github.com/DonJayamanne/pythonVSCode/wiki/Python-Path-and-Version#python-version-used-for-intellisense-autocomplete-linting-formatting-etc)) 

For further information and details continue through to the [documentation](https://github.com/DonJayamanne/pythonVSCode/wiki).

##Feature Requests and contributions
* Contributions are always welcome. Fork it, modify it and create a pull request.
  + Details on contributing can be found [here](https://github.com/DonJayamanne/pythonVSCode/wiki/Contribution) 
* Any and all feedback is appreciated and welcome.
  + Please feel free to [add suggestions here](https://github.com/DonJayamanne/pythonVSCode/issues/183)

##[Roadmap](https://github.com/DonJayamanne/pythonVSCode/issues/183)
_Please note, not all of these feature may be developed.   
Your feedback is crucial in prioritizing the items and in determining whether we shift focus our attention to some other feature request(s)._    
* Intellisense and Linting
  + Performance improvements
  + Linting as you type
  + Context actions for some linter messages
  + Remote Interpretter
* Miscellaneous IDE enhancements
  + Code Refactoring 
  + Auto-generate docstring
  + Documentation viewer
  + Improved integration of Unit Tests
* Integration
  + Code coverage
  + Profiler
  + Integrating IPython
* Debugging enhancements  
  + Integration with VS Code Terminal window
  + Securely debugging Python applications in the cloud (Azure, AWS or Google Cloud)
  + Remote debugging over SSH

##[Issues and Feature Requests](https://github.com/DonJayamanne/pythonVSCode/issues)

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
* Unit Testing
 + Support for unittests, nosetests and pytest
 + Test results are displayed in the "Python" output window
* Snippets


![Image of Generate Features](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/general.gif)

![Image of Debugging](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/standardDebugging.gif)

## [Change Log](https://github.com/DonJayamanne/pythonVSCode/releases)

### Current Version 0.3.18  
* Modifications to support environment variables in settings [#148](https://github.com/DonJayamanne/pythonVSCode/issues/148)
* Modifications to support formatting of selected text [#197](https://github.com/DonJayamanne/pythonVSCode/issues/197) and [#183](https://github.com/DonJayamanne/pythonVSCode/issues/183)
* Added support to intellisense for parameters [#71](https://github.com/DonJayamanne/pythonVSCode/issues/71)
* Display name of linter along with diagnostic messages [#199](https://github.com/DonJayamanne/pythonVSCode/issues/199)

## Source

[GitHub](https://github.com/DonJayamanne/pythonVSCode)

                
## License

[MIT](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/LICENSE)
