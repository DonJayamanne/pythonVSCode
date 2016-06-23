# Python
Linting, Debugging (multi-threaded, web apps, remote), Intellisense, auto-completion, code formatting, snippets, unit testing, and more.

##[Documentation](https://github.com/DonJayamanne/pythonVSCode/wiki)
###Getting Started
* Install the extension
* If using a custom Python Version or a Virtual Environment, then configure the path to the python executable in settings.json ([further details here](https://github.com/DonJayamanne/pythonVSCode/wiki/Python-Path-and-Version#python-version-used-for-intellisense-autocomplete-linting-formatting-etc))  
###[Troubleshooting guide](https://github.com/DonJayamanne/pythonVSCode/wiki/Troubleshooting)

###Feature Requests and contributions
* Contributions are always welcome. Fork it, make the changes and create a pull request
* Your feedback will make this a better product, so all feedback is appreciated and welcome.
  + Please feel free to [add suggestions here](https://github.com/DonJayamanne/pythonVSCode/issues/183)

###Roadmap
_Please note, not all of these feature may be developed.   
Your feedback is crucial in prioritizing the items and in determining whether we focus our attention to some other feature request(s)._    
* Intellisense and Linting
  + Performance improvements
  + Linting as you type
  + Context actions for some linter messages
* Miscellaneous tools
  + Code coverage
  + Profiler
* Remote Interpretter
* Integrating IPython
* Miscellaneous IDE enhancements
  + Code Refactoring 
  + Autogenerate docstring
  + Documentation viewer
  + Improved integration of Unit Tests
* Debugging enhancements  
  + Integration with VS Code Terminal window
  + Securely debugging Python applications in the cloud (Azure, AWS or Google Cloud)
  + Remote debugging over SSH

##Features
* Linting (Prospector, PyLint, Pep8, Flake8, pydocstyle with config files and plugins)
* Intellisense and autocompletion
* Auto indenting
* Code formatting (autopep8, yapf, with config files)
* Renaming, Viewing references, Going to definitions, Go to Symbols
* View signature and similar by hovering over a function or method
* Debugging with support for local variables, arguments, expressions, watch window, stack information, break points
* Debugging Multiple threads (Web Applications - Flask, etc) and expanding values (on Windows and Mac)
* Debugging remote processes (attaching to local and remote process)
* Debugging with support for shebang (windows)
* Debugging with custom environment variables
* Unit testing (unittests and nosetests, with config files)
* Sorting imports
* Snippets

##[Issues and Feature Requests](https://github.com/DonJayamanne/pythonVSCode/issues)

## Feature Details
* IDE Features
 + Auto indenting
 + Code navigation (Go to, Find all references)
 + Code definition (Peek and hover definition, View Signature)
 + Rename refactoring
 + Sorting Import statements (use "Python: Sort Imports" command)
* [Intellisense and Autocomplete](https://github.com/DonJayamanne/pythonVSCode/wiki/Autocomplete-Intellisense)
 + Ability to include custom module paths (e.g. include paths for libraries like Google App Engine, etc)
 + Use the setting python.autoComplete.extraPaths = []
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
 + It can be turned off (default is turn it on and use pylint)
 + Multiple linters supported (along with support for configuration files for each linter)
 + Supported linters include pylit, pep8, flake8, pydocstyle, prospector
 + Paths to each of the linters can be optionally configured
 + Custom plugins such as pylint plugin for Django can be easily used by modifying the settings as follows:
```json
"python.linting.pylintArgs": ["--load-plugins", "pylint_django"]
``` 
* [Debuggging](https://github.com/DonJayamanne/pythonVSCode/wiki/Debugging)
 + Watch window
 + Evaluate Expressions
 + Step through code (Step in, Step out, Continue)
 + Add/remove break points
 + Local variables and arguments
 + Multiple Threads and Web Applications (such as Flask) (Windows and Mac)
 + Expanding values (viewing children, properties, etc) (Windows and Mac)
 + Conditional breakpoints
 + Remote debugging
* Unit Testing
 + Support for unittests, nosetests and pytest
 + Test resutls are displayed in the "Python" output window
* Snippets


![Image of Generate Features](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/general.gif)

![Image of Go To Definition](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/goToDef.gif)

![Image of Renaming and Find all References](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/rename.gif)

![Image of Debugging](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/standardDebugging.gif)

![Image of Multi Threaded Debugging](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/flaskDebugging.gif)

![Image of Pausing](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/break.gif)

## Change Log

### Version 0.3.12  
* Changes to how linters and formatters are executed (optimizations and changes to settings to separate out the command line arguments) [#178](https://github.com/DonJayamanne/pythonVSCode/issues/178)[#163](https://github.com/DonJayamanne/pythonVSCode/issues/163)
* Fix to support Unicode characters in debugger [#102](https://github.com/DonJayamanne/pythonVSCode/issues/102)
* Added support for {workspaceRoot} in Path settings defined in settings.js [#148](https://github.com/DonJayamanne/pythonVSCode/issues/148)
* Resolving path of linters and formatters based on python path defined in settings.json [#148](https://github.com/DonJayamanne/pythonVSCode/issues/148)
* Better handling of Paths to python executable and related tools (linters, formatters) in virtual environments [#148](https://github.com/DonJayamanne/pythonVSCode/issues/148)
* Added support for configurationDone event in debug adapter [#168](https://github.com/DonJayamanne/pythonVSCode/issues/168)[#145](https://github.com/DonJayamanne/pythonVSCode/issues/145)

### Version 0.3.11  
* Added support for telemetry [#156](https://github.com/DonJayamanne/pythonVSCode/issues/156)
* Optimized code formatting and sorting of imports [#150](https://github.com/DonJayamanne/pythonVSCode/issues/150), [#151](https://github.com/DonJayamanne/pythonVSCode/issues/151), [#157](https://github.com/DonJayamanne/pythonVSCode/issues/157)
* Fixed issues in code formatting [#171](https://github.com/DonJayamanne/pythonVSCode/issues/171)
* Modifications to display errors returned by debugger [#111](https://github.com/DonJayamanne/pythonVSCode/issues/111)
* Fixed the prospector linter [#142](https://github.com/DonJayamanne/pythonVSCode/issues/142)
* Modified to resolve issues where debugger wasn't handling code exceptions correctly [#159](https://github.com/DonJayamanne/pythonVSCode/issues/159)
* Added support for unit tests using pytest [#164](https://github.com/DonJayamanne/pythonVSCode/issues/164)

### Version 0.3.10
* Fixed issue with duplicate output channels being created
* Fixed issues in the LICENSE file
* Fixed issue where current directory was incorrect [#68](https://github.com/DonJayamanne/pythonVSCode/issues/68)
* General cleanup of code

### Version 0.3.9
* Fixed auto indenting issues [#137](https://github.com/DonJayamanne/pythonVSCode/issues/137)

### Version 0.3.8
* Added support for linting using prospector [#130](https://github.com/DonJayamanne/pythonVSCode/pull/130)
* Fixed issue where environment variables weren't being inherited by the debugger [#109](https://github.com/DonJayamanne/pythonVSCode/issues/109) and [#77](https://github.com/DonJayamanne/pythonVSCode/issues/77)

### Version 0.3.7
* Added support for auto indenting of some keywords [#83](https://github.com/DonJayamanne/pythonVSCode/issues/83)
* Added support for launching console apps for Mac [#128](https://github.com/DonJayamanne/pythonVSCode/issues/128)
* Fixed issue where configuration files for pylint, pep8 and flake8 commands weren't being read correctly [#117](https://github.com/DonJayamanne/pythonVSCode/issues/117)

### Version 0.3.6
* Added support for linting using pydocstyle [#56](https://github.com/DonJayamanne/pythonVSCode/issues/56)
* Added support for auto-formatting documents upon saving (turned off by default) [#27](https://github.com/DonJayamanne/pythonVSCode/issues/27)
* Added support to configure the output window for linting, formatting and unit test messages [#112](https://github.com/DonJayamanne/pythonVSCode/issues/112)

### Version 0.3.5
* Fixed printing of unicode characters when evaulating expressions [#73](https://github.com/DonJayamanne/pythonVSCode/issues/73)

### Version 0.3.4
* Updated snippets
* Fixes to remote debugging [#65](https://github.com/DonJayamanne/pythonVSCode/issues/65)
* Fixes related to code navigation [#58](https://github.com/DonJayamanne/pythonVSCode/issues/58) and [#78](https://github.com/DonJayamanne/pythonVSCode/pull/78)
* Changes to allow code navigation for methods

### Version 0.3.2
* Ability to control how debugger breaks into exceptions raised (always break, never break or only break if unhandled)
* Disabled displaying of errors, as there are a few instances when errors are displayed in the IDE when not required

### Version 0.3.1
* Remote debugging (updated documentation and fixed minor issues)
* Fixed issues with formatting of files when path contains spaces

### Version 0.3.0
* Remote debugging (attaching to local and remote processes)
* Debugging with support for shebang
* Support for passing environment variables to debug program
* Improved error handling in the extension

### Version 0.2.9
* Added support for debugging django applications
 + Debugging templates is not supported at this stage

### Version 0.2.8
* Added support for conditional break points
* Added ability to optionally display the shell window (Windows Only, Mac is coming soon)
  +  Allowing an interactive shell window, which isn't supported in VSCode.
* Added support for optionally breaking into python code as soon as debugger starts 
* Fixed debugging when current thread is busy processing.
* Updated documentation with samples and instructions

### Version 0.2.4
* Fixed issue where debugger would break into all exceptions
* Added support for breaking on all and uncaught exceptions   
* Added support for pausing (breaking) into a running program while debugging.

### Version 0.2.3
* Fixed termination of debugger

### Version 0.2.2
* Improved debugger for Mac, with support for Multi threading, Web Applications, expanding properties, etc
* (Debugging now works on both Windows and Mac)
* Debugging no longer uses PDB

### Version 0.2.1
* Improved debugger for Windows, with support for Multi threading, debugging Multi-threaded apps, Web Applications, expanding properties, etc
* Added support for relative paths for extra paths in additional libraries for Auto Complete
* Fixed a bug where paths to custom Python versions weren't respected by the previous (PDB) debugger
* NOTE: PDB Debugger is still supported

### Version 0.1.3
* Fixed linting when using pylint

### Version 0.1.2
* Fixed autoformatting of code (falling over when using yapf8)

### Version 0.1.1
* Added support for linting using flake8
* Added support for unit testing using unittest and nosetest
* Added support for custom module paths for improved intellisense and autocomplete
* Modifications to debugger to display console output (generated using 'print' and the like)
* Modifications to debugger to accept arguments

### Version 0.1.0
* Fixed linting of files on Mac
* Added support for linting using pep8
* Added configuration support for pep8 and pylint
* Added support for configuring paths for pep8, pylint and autopep8
* Added snippets
* Added support for formatting using yapf
* Added a number of configuration settings

### Version 0.0.4
* Added support for linting using Pylint (configuring pylint is coming soon)
* Added support for sorting Imports (Using the command "Pythong: Sort Imports")
* Added support for code formatting using Autopep8 (configuring autopep8 is coming soon)
* Added ability to view global variables, arguments, add and remove break points

### Version 0.0.3
* Added support for debugging using PDB

## Source

[Github](https://github.com/DonJayamanne/pythonVSCode)

                
## License

[MIT](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/LICENSE)
