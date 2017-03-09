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
 + This functionality has been moved into a separate extension [Jupyter](https://marketplace.visualstudio.com/items?itemName=donjayamanne.python)
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
### Version 0.6.0 (10 March 2017)
* Moved Jupyter functionality into a separate extension [Jupyter]()
* Updated readme [#779](https://github.com/DonJayamanne/pythonVSCode/issues/779)
* Changing default arguments of ```mypy``` [#658](https://github.com/DonJayamanne/pythonVSCode/issues/658)
* Added ability to disable formatting [#559](https://github.com/DonJayamanne/pythonVSCode/issues/559)
* Fixing ability to run a Python file in a terminal [#784](https://github.com/DonJayamanne/pythonVSCode/issues/784)
* Added support for Proxy settings when installing Python packages using Pip [#778](https://github.com/DonJayamanne/pythonVSCode/issues/778)

### Version 0.5.9 (2 March 2017)
* Fixed navigating to definitions [#711](https://github.com/DonJayamanne/pythonVSCode/issues/711)  
* Support auto detecting binaries from Python Path [#716](https://github.com/DonJayamanne/pythonVSCode/issues/716)  
* Setting PYTHONPATH environment variable [#686](https://github.com/DonJayamanne/pythonVSCode/issues/686)  
* Improving Linter performance, killing redundant processes [4a8319e](https://github.com/DonJayamanne/pythonVSCode/commit/4a8319e0859f2d49165c9a08fe147a647d03ece9)  
* Changed default path of the CATAS file to `.vscode/tags` [#722](https://github.com/DonJayamanne/pythonVSCode/issues/722)  
* Add parsing severity level for flake8 and pep8 linters [#709](https://github.com/DonJayamanne/pythonVSCode/pull/709)  
* Fix to restore function descriptions (intellisense) [#727](https://github.com/DonJayamanne/pythonVSCode/issues/727)  
* Added default configuration for debugging Pyramid [#287](https://github.com/DonJayamanne/pythonVSCode/pull/287)  
* Feature request: Run current line in Terminal [#738](https://github.com/DonJayamanne/pythonVSCode/issues/738)  
* Miscellaneous improvements to hover provider [6a7a3f3](https://github.com/DonJayamanne/pythonVSCode/commit/6a7a3f32ab8add830d13399fec6f0cdd14cd66fc), [6268306](https://github.com/DonJayamanne/pythonVSCode/commit/62683064d01cfc2b76d9be45587280798a96460b)  
* Fixes to rename refactor (due to 'LF' EOL in Windows) [#748](https://github.com/DonJayamanne/pythonVSCode/pull/748)  
* Fixes to ctag file being generated in home folder when no workspace is opened [#753](https://github.com/DonJayamanne/pythonVSCode/issues/753)  
* Fixes to ctag file being generated in home folder when no workspace is opened [#753](https://github.com/DonJayamanne/pythonVSCode/issues/753)  
* Disabling auto-completion in single line comments [#74](https://github.com/DonJayamanne/pythonVSCode/issues/74)  
* Fixes to debugging of modules [#518](https://github.com/DonJayamanne/pythonVSCode/issues/518)  
* Displaying unit test status icons against unit test code lenses [#678](https://github.com/DonJayamanne/pythonVSCode/issues/678)  
* Fix issue where causing 'python.python-debug.startSession' not found message to be displayed when debugging single file [#708](https://github.com/DonJayamanne/pythonVSCode/issues/708)  
* Ability to include packages directory when generating tags file [#735](https://github.com/DonJayamanne/pythonVSCode/issues/735)  
* Fix issue where running selected text in terminal does not work [#758](https://github.com/DonJayamanne/pythonVSCode/issues/758)  
* Fix issue where disabling linter doesn't disable it (when no workspace is open) [#763](https://github.com/DonJayamanne/pythonVSCode/issues/763)  
* Search additional directories for Python Interpreters (~/.virtualenvs, ~/Envs, ~/.pyenv) [#569](https://github.com/DonJayamanne/pythonVSCode/issues/569)  
* Added ability to pre-load some modules to improve autocompletion [#581](https://github.com/DonJayamanne/pythonVSCode/issues/581)  
* Removed invalid default value in launch.json file [#586](https://github.com/DonJayamanne/pythonVSCode/issues/586)  
* Added ability to configure the pylint executable path [#766](https://github.com/DonJayamanne/pythonVSCode/issues/766)  
* Fixed single file debugger to ensure the Python interpreter configured in python.PythonPath is being used [#769](https://github.com/DonJayamanne/pythonVSCode/issues/769)  

### Thanks
* [Alexander Millin](https://github.com/millin)
* [Andris Raugulis](https://github.com/arthepsy)
* [codebetter](https://github.com/skilliscode)
* [Georgy Dyuldin](https://github.com/gdyuldin)
* [Igor Novozhilov](https://github.com/IgorNovozhilov)
* [Jacques Latrive](https://github.com/jltrv)
* [Luca Mussi](https://github.com/splendido)
* [Nobuhiro Nakamura](https://github.com/lefb766)
* [Patryk Zawadzki](https://github.com/patrys)
* [Shay Palachy](https://github.com/shaypal5)
* [Shengyu Fu](https://github.com/shengyfu)
* [Siddhartha Gandhi](https://github.com/gandhis1)
* [Thijs Damsma](https://github.com/tdamsma)
* [uralbash](https://github.com/uralbash)
* [viewstar000](https://github.com/viewstar000)
* [Water Zheng](https://github.com/zhengxiaoyao0716)
* [Zunny Zhong](https://github.com/drzunny)

## Source

[GitHub](https://github.com/DonJayamanne/pythonVSCode)

                
## License

[MIT](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/LICENSE)
