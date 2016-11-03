# Python

An extension with rich support for the [Python language](https://www.python.org/), with features including the following and more:   
* Linting ([Prospector](https://pypi.io/project/prospector/), [Pylint](https://pypi.io/project/pylint/), [pycodestyle](https://pypi.io/project/pycodestyle/)/Pep8, [Flake8](https://pypi.io/project/flake8/), [pydocstyle](https://pypi.io/project/pydocstyle/) with config files and plugins)
* Intellisense (autocompletion)
* Scientific tools (Jupyter/IPython)
* Auto indenting
* Code formatting ([autopep8](https://pypi.io/project/autopep8/), [yapf](https://pypi.io/project/yapf/), with config files)
* Code refactoring ([Rename](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Rename), [Extract Variable](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Variable), [Extract Method](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Method), [Sort Imports](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Sort-Imports))
* Viewing references, code navigation, view signature
* Excellent debugging support (remote debugging over SSH, mutliple threads, django, flask)
* Unit testing, including debugging ([unittest](https://docs.python.org/3/library/unittest.html#module-unittest), [pytest](https://pypi.io/project/pytest/), [nosetests](https://pypi.io/project/nose/), with config files)
* Execute file or code in a python terminal
* Local help file (offline documentation)
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
* [Scientific tools (Jupyter/IPython)](https://github.com/DonJayamanne/pythonVSCode/wiki/Jupyter-(IPython))
 + Executing blocks of code (cells) in a Jupyter Kernel
 + Managing kernels (restarting, stopping, interrupting and selecting different kernels)
 + Viewing interactive graphs, HTML, SVG, LaTeX output from Jupyter from within Visual Studio Code 
* [Code formatting](https://github.com/DonJayamanne/pythonVSCode/wiki/Formatting)
 + Auto formatting of code upon saving changes (default to 'Off')
 + Use either yapf or autopep8 for code formatting (defaults to autopep8)
* [Linting](https://github.com/DonJayamanne/pythonVSCode/wiki/Linting)
 + It can be turned off (default is to be turned on and use pylint)
 + Multiple linters supported (along with support for configuration files for each linter)
 + Supported linters include pylint, pep8, flake8, pydocstyle, prospector
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
 + Multiple Threads and Web Applications (such as Flask, Django, with template debugging)
 + Expanding values (viewing children, properties, etc)
 + Conditional break points
 + Remote debugging (over SSH)
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

![Image of Scientific Tools](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/jupyter/examples.gif)

![Image of Local Help](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/help.gif)

## [Roadmap](https://donjayamanne.github.io/pythonVSCodeDocs/docs/roadmap/)

## [Change Log](https://github.com/DonJayamanne/pythonVSCode/releases)

### Current Version 0.5.0
* Remove dependency on zmq when using Jupyter or IPython (pure python solution)
* Added a default keybinding for ```Jupyter:Run Selection/Line``` of ```ctrl+alt+enter```
* Changes to update settings.json with path to python using [native API](https://github.com/DonJayamanne/pythonVSCode/commit/bce22a2b4af87eaf40669c6360eff3675280cdad)
* Changes to use [native API](https://github.com/DonJayamanne/pythonVSCode/commit/bce22a2b4af87eaf40669c6360eff3675280cdad) for formatting when saving documents
* Reusing existing terminal instead of creating new terminals
* Limiting linter messages to opened documents (hide messages if document is closed) [#375](https://github.com/DonJayamanne/pythonVSCode/issues/375)
* Resolving extension load errors when  [#375](https://github.com/DonJayamanne/pythonVSCode/issues/375)
* Fixes to discovering unittests [#386](https://github.com/DonJayamanne/pythonVSCode/issues/386)
* Fixes to sending code to terminal on Windows [#387](https://github.com/DonJayamanne/pythonVSCode/issues/387)
* Fixes to executing python file in terminal on Windows [#385](https://github.com/DonJayamanne/pythonVSCode/issues/385)
* Fixes to launching local help (documentation) on Linux
* Fixes to typo in configuration documentation [#391](https://github.com/DonJayamanne/pythonVSCode/pull/391)
* Fixes to use ```python.pythonPath``` when sorting imports  [#393](https://github.com/DonJayamanne/pythonVSCode/pull/393)
* Fixes to linters to handle situations when line numbers aren't returned [#399](https://github.com/DonJayamanne/pythonVSCode/pull/399)
* Fixes to signature tooltips when docstring is very long [#368](https://github.com/DonJayamanne/pythonVSCode/issues/368), [#113](https://github.com/DonJayamanne/pythonVSCode/issues/113)

### Thanks
* [Igor Novozhilov](https://github.com/IgorNovozhilov)
    + Fix for autocompletion and code navigation with unicode characters [#372](https://github.com/DonJayamanne/pythonVSCode/issues/372), [#364](https://github.com/DonJayamanne/pythonVSCode/issues/364)
* [Luca Mussi](https://github.com/splendido)
    + Fix typo in configuration documentation [#391](https://github.com/DonJayamanne/pythonVSCode/pull/391)
    + Fix to use ```python.pythonPath``` when sorting imports  [#393](https://github.com/DonJayamanne/pythonVSCode/pull/393)
* [Andris Raugulis](https://github.com/arthepsy)

## Source

[GitHub](https://github.com/DonJayamanne/pythonVSCode)

                
## License

[MIT](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/LICENSE)
