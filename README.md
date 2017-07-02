# Python

An extension with rich support for the [Python language](https://www.python.org/) (_including Python 3.6_), with features including the following and more:   
* Linting ([Prospector](https://pypi.io/project/prospector/), [Pylint](https://pypi.io/project/pylint/), [pycodestyle](https://pypi.io/project/pycodestyle/)/Pep8, [Flake8](https://pypi.io/project/flake8/), [pylama](https://github.com/klen/pylama), [pydocstyle](https://pypi.io/project/pydocstyle/) with config files and plugins)
* Intellisense (autocompletion with support for PEP-0484)
* Auto indenting
* Code formatting ([autopep8](https://pypi.io/project/autopep8/), [yapf](https://pypi.io/project/yapf/), with config files)
* Code refactoring ([Rename](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Rename), [Extract Variable](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Variable), [Extract Method](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Method), [Sort Imports](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Sort-Imports))
* Viewing references, code navigation, view signature
* Excellent debugging support (remote debugging over SSH, mutliple threads, django, flask)
* Running and debugging Unit tests ([unittest](https://docs.python.org/3/library/unittest.html#module-unittest), [pytest](https://pypi.io/project/pytest/), [nosetests](https://pypi.io/project/nose/), with config files)
* Execute file or code in a python terminal
* Local help file (offline documentation)
* Snippets

## Quick Start
* Install the extension
* optionally install `ctags` for Workspace Symbols, from [here](http://ctags.sourceforge.net/), or using `brew install ctags` on OSX.
* If Python is in the current path
  + You're ready to use it.
* To select a different Python Interpreter/Version (or use Virtual Environment), use the command [```Select Workspace Interpreter```](https://github.com/DonJayamanne/pythonVSCode/wiki/Miscellaneous#select-an-interpreter)) 

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
* [Intellisense and Autocomplete](https://github.com/DonJayamanne/pythonVSCode/wiki/Autocomplete-Intellisense) with support for PEP-0484
 + Ability to include custom module paths (e.g. include paths for libraries like Google App Engine, etc.)
 + Use the `setting python.autoComplete.extraPaths = []`
 + For instance getting autocomplete/intellisense for Google App Engine, add the following to your settings file:
```json
"python.autoComplete.extraPaths": [
    "C:/Program Files (x86)/Google/google_appengine",
    "C:/Program Files (x86)/Google/google_appengine/lib" ]
```
* [Scientific tools (Jupyter/IPython)](https://marketplace.visualstudio.com/items?itemName=donjayamanne.python)
 + This functionality has been moved into a separate extension [Jupyter](https://marketplace.visualstudio.com/items?itemName=donjayamanne.jupyter)
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
 + Debugging unittests
* Snippets
* Miscellaneous
 + Running a file or selected text in python terminal
* Refactoring
 + [Rename Refactorings](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Rename)
 + [Extract Variable Refactorings](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Variable)
 + [Extract Method Refactorings](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Extract-Method)
 + [Sort Imports](https://github.com/DonJayamanne/pythonVSCode/wiki/Refactoring:-Sort-Imports)

![Generate Features](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/general.gif)

![Debugging](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/debugDemo.gif)

![Unit Tests](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/unittest.gif)

![Scientific Tools](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/jupyter/examples.gif)

![Local Help](https://raw.githubusercontent.com/DonJayamanne/pythonVSCodeDocs/master/images/help.gif)

## [Roadmap](https://donjayamanne.github.io/pythonVSCodeDocs/docs/roadmap/)

## [Change Log](https://github.com/DonJayamanne/pythonVSCode/blob/master/CHANGELOG.md)

### Version 0.6.6 (02 July 2017)
* Provide details of error with solution for changes to syntax in launch.json [#1047](https://github.com/DonJayamanne/pythonVSCode/issues/1047), [#1025](https://github.com/DonJayamanne/pythonVSCode/issues/1025)
* Provide a warning about known issues with having pyenv.cfg whilst debugging [#913](https://github.com/DonJayamanne/pythonVSCode/issues/913)  
* Create .vscode directory if not found [#1043](https://github.com/DonJayamanne/pythonVSCode/issues/1043)  
* Highlighted text due to linter errors is off by one column [#965](https://github.com/DonJayamanne/pythonVSCode/issues/965), [#970](https://github.com/DonJayamanne/pythonVSCode/pull/970)  
* Added preminary support for WSL Bash and Cygwin [#1049](https://github.com/DonJayamanne/pythonVSCode/pull/1049)  
* Ability to configure the linter severity levels [#941](https://github.com/DonJayamanne/pythonVSCode/pull/941), [#895](https://github.com/DonJayamanne/pythonVSCode/issues/895)  
* Fixes to unit tests [#1051](https://github.com/DonJayamanne/pythonVSCode/pull/1051), [#1050](https://github.com/DonJayamanne/pythonVSCode/pull/1050)    
* Outdent lines following `contibue`, `break` and `return` [#1050](https://github.com/DonJayamanne/pythonVSCode/pull/1050)  
* Change location of cache for Jedi files [#1035](https://github.com/DonJayamanne/pythonVSCode/pull/1035)  
* Fixes to the way directories are searched for Python interpreters [#569](https://github.com/DonJayamanne/pythonVSCode/issues/569), [#1040](https://github.com/DonJayamanne/pythonVSCode/pull/1040)  
* Handle outputs from Python packages that interfere with the way autocompletion is handled [#602](https://github.com/DonJayamanne/pythonVSCode/issues/602)  


### Version 0.6.5 (13 June 2017)
* Fix error in launch.json [#1006](https://github.com/DonJayamanne/pythonVSCode/issues/1006)    
* Detect current workspace interpreter when selecting interpreter [#1006](https://github.com/DonJayamanne/pythonVSCode/issues/979)    
* Disable output buffering when debugging [#1005](https://github.com/DonJayamanne/pythonVSCode/issues/1005)
* Updated snippets to use correct placeholder syntax [#976](https://github.com/DonJayamanne/pythonVSCode/pull/976)  
* Fix hover and auto complete unit tests [#1012](https://github.com/DonJayamanne/pythonVSCode/pull/1012)  
* Fix hover definition variable test for Python 3.5 [#1013](https://github.com/DonJayamanne/pythonVSCode/pull/1013)  
* Better formatting of docstring [#821](https://github.com/DonJayamanne/pythonVSCode/pull/821), [#919](https://github.com/DonJayamanne/pythonVSCode/pull/919)  
* Supporting more paths when searching for Python interpreters [#569](https://github.com/DonJayamanne/pythonVSCode/issues/569)  
* Increase buffer output (to support detection large number of tests) [#927](https://github.com/DonJayamanne/pythonVSCode/issues/927)  

### Thanks  
* [Yu Zhang](https://github.com/neilsustc)


## Source

[GitHub](https://github.com/DonJayamanne/pythonVSCode)

                
## License

[MIT](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/LICENSE)
