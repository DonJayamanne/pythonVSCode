### Welcome to Python for Visual Studio Code

Python for Visual Studio Code is an extension for Visual Studio which aims at providing you with the best python development environment and experience possible. The extension is built for the Visual Studio Code IDE that is built from the ground up using Open Source technologies such as NodeJs.

![Image of Generate Features](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/general.gif)

![Image of Debugging](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/images/standardDebugging.gif)

### Open Source and Cross Platforma
The extension along with the IDE is both open source and runs on multiple platforms such as Windows, Mac and Linux.
Both the [Python extension](https://github.com/DonJayamanne/pythonVSCode) and [Visual Studio Code](https://github.com/Microsoft/vscode) are built using open source technologies such as NodeJs.
 
## Works out of the box
Once installed, the extension works out of the box with absolutely no configuration.
This is made possible by using the default Python interpreter available in the current PATH variable on the operating system.

If necessary, the python interpreter being used by the extension could be changed to point to a specific version of the interpreter (or one that is in a specific virtual environment). This is made possible by altering the following setting in the [User or Workspace settings file](https://code.visualstudio.com/Docs/customization/userandworkspace):
```json
“python.pythonPath” : “<fully qualified path to the python interpreter>”
```

## Features

### Virtual Environments
Python virtual environments are completely supported. 

### Rich Intellisense (code completion)
The extension provides a very rich set of intellisense and code completion capabilities. This significantly reduces the development effort by removing the guess work from the equation. Intellisense (code completion) works out of the box with no additional configuration. However, this can be fined tuned if necessary.

### Code Navigation and the like
The extension integrates with most if not all of the code navigation capabilities exposed by the Visual Studio Code IDE. What this means to the end user is simple, features such as Go to Definition, Go to Symbol, Find all References, hover over a symbol to view the documentation, etc. are available to the user through the IDE via standard commands and interfaces.   
This alone feature alone saves development time and effort with improved code navigation.

### Linting
The extension utilizes some of the best and most popular python linters in order to analyze the source code and provide feedback to the user. Popular linters such as Pylint, Flake8, pydocstyle, and the like are used. As a user you could either use all of them or just one or none. Users have the ability to fine tune each linter placing relevant configuration files in the project directory.

### Code formatting
Code formatting ensures your code meets certain standards of coding styles. This capability is provided by using either one of Yapf or AutoPep8 library. Using this feature you can be assured your code meets some of the best known standards in python coding (format) styles.

### Debugging
The debugging experience provided is unparalleled. You could debug almost any type of application, web and console applications, local and remote applications (yes remote debugging too). The debugger provides a rich set of debugging capabilities such as:
* Multi-threaded debugging
* Local variables and arguments 
* Watch window and stack trace
* Conditional breakpoints
* Evaluating expressions 
* and more

### Miscellaneous features that make this a great Python development IDE
* Executing unit tests
* Rename refactor
* Sort imports within a python file
* Auto-indenting as you type
* Total control over the linters and formatters used

### Creating pages manually
If you prefer to not use the automatic generator, push a branch named `gh-pages` to your repository to create a page manually. In addition to supporting regular HTML content, GitHub Pages support Jekyll, a simple, blog aware static site generator. Jekyll makes it easy to create site-wide headers and footers without having to copy them across every page. It also offers intelligent blog support and other advanced templating features.

## Contributions and Suggestions
If you have an idea, we’d love to hear about it, you can add them [here](https://github.com/DonJayamanne/pythonVSCode/issues/183).
If you think you can build it, then by all means fork the repo, make the changes and create a pull request.

## License
[MIT](https://raw.githubusercontent.com/DonJayamanne/pythonVSCode/master/LICENSE)
