# Python extension for Visual Studio Code

A [Visual Studio Code](https://code.visualstudio.com/) [extension](https://marketplace.visualstudio.com/VSCode) with rich support for the [Python language](https://www.python.org/) (for all [actively supported versions](https://devguide.python.org/#status-of-python-branches) of the language: >=3.7), including features such as IntelliSense (Pylance), linting, debugging, code navigation, code formatting, refactoring, variable explorer, test explorer, and more!

## Support for [vscode.dev](https://vscode.dev/)

The Python extension does offer [some support](https://github.com/microsoft/vscode-python/wiki/Partial-mode) when running on [vscode.dev](https://vscode.dev/) (which includes [github.dev](http://github.dev/)). This includes partial IntelliSense for open files in the editor.


## Installed extensions

The Python extension will automatically install the [Pylance](https://marketplace.visualstudio.com/items?itemName=ms-python.vscode-pylance) extension to give you the best experience when working with Python files. However, Pylance is an optional dependency, meaning the Python extension will remain fully functional if it fails to be installed. You can also [uninstall](https://code.visualstudio.com/docs/editor/extension-marketplace#_uninstall-an-extension) it at the expense of some features if you’re using a different language server.

Extensions installed through the marketplace are subject to the [Marketplace Terms of Use](https://cdn.vsassets.io/v/M146_20190123.39/_content/Microsoft-Visual-Studio-Marketplace-Terms-of-Use.pdf).

## Quick start

-   **Step 1.** [Install a supported version of Python on your system](https://code.visualstudio.com/docs/python/python-tutorial#_prerequisites) (note: that the system install of Python on macOS is not supported).
-   **Step 2.** [Install the Python extension for Visual Studio Code](https://code.visualstudio.com/docs/editor/extension-gallery).
-   **Step 3.** Open or create a Python file and start coding!

## Set up your environment

<!-- use less words -->

-   Select your Python interpreter by clicking on the status bar

     <img src=https://raw.githubusercontent.com/microsoft/vscode-python/main/images/InterpreterSelectionZoom.gif width=280 height=100>

-   Configure the debugger through the Debug Activity Bar

     <img src=https://raw.githubusercontent.com/microsoft/vscode-python/main/images/ConfigureDebugger.gif width=734 height=413>

-   Configure tests by running the `Configure Tests` command

     <img src=https://raw.githubusercontent.com/microsoft/vscode-python/main/images/ConfigureTests.gif width=734 height=413>

## Jupyter Notebook quick start

The Python extension offers support for Jupyter notebooks via the [Jupyter extension](https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter) to provide you a great Python notebook experience in VS Code. 

- Install the [Jupyter extension](https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter).

-   Open or create a Jupyter Notebook file (.ipynb) and start coding in our Notebook Editor!

     <img src=https://raw.githubusercontent.com/microsoft/vscode-python/main/images/OpenOrCreateNotebook.gif width=1029 height=602>

For more information you can:

-   [Follow our Python tutorial](https://code.visualstudio.com/docs/python/python-tutorial#_prerequisites) with step-by-step instructions for building a simple app.
-   Check out the [Python documentation on the VS Code site](https://code.visualstudio.com/docs/languages/python) for general information about using the extension.
-   Check out the [Jupyter Notebook documentation on the VS Code site](https://code.visualstudio.com/docs/python/jupyter-support) for information about using Jupyter Notebooks in VS Code.

## Useful commands

Open the Command Palette (Command+Shift+P on macOS and Ctrl+Shift+P on Windows/Linux) and type in one of the following commands:

| Command                               | Description                                                                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Python: Select Interpreter`          | Switch between Python interpreters, versions, and environments.                                                                                                |
| `Python: Start REPL`                  | Start an interactive Python REPL using the selected interpreter in the VS Code terminal.                                                                       |
| `Python: Run Python File in Terminal` | Runs the active Python file in the VS Code terminal. You can also run a Python file by right-clicking on the file and selecting `Run Python File in Terminal`. |
| `Python: Select Linter`               | Switch from Pylint to Flake8 or other supported linters.                                                                                                       |
| `Format Document`                     | Formats code using the provided [formatter](https://code.visualstudio.com/docs/python/editing#_formatting) in the `settings.json` file.                        |
| `Python: Configure Tests`             | Select a test framework and configure it to display the Test Explorer.                                                                                         |

To see all available Python commands, open the Command Palette and type `Python`. For Jupyter extension commands, just type `Jupyter`.

## Feature details

Learn more about the rich features of the Python extension:

-   [IntelliSense](https://code.visualstudio.com/docs/python/editing#_autocomplete-and-intellisense): Edit your code with auto-completion, code navigation, syntax checking and more
-   [Linting](https://code.visualstudio.com/docs/python/linting): Get additional code analysis with Pylint, Flake8 and more
-   [Code formatting](https://code.visualstudio.com/docs/python/editing#_formatting): Format your code with black, autopep or yapf

-   [Debugging](https://code.visualstudio.com/docs/python/debugging): Debug your Python scripts, web apps, remote or multi-threaded processes

-   [Testing](https://code.visualstudio.com/docs/python/unit-testing): Run and debug tests through the Test Explorer with unittest or pytest.

-   [Jupyter Notebooks](https://code.visualstudio.com/docs/python/jupyter-support): Create and edit Jupyter Notebooks, add and run code cells, render plots, visualize variables through the variable explorer, visualize dataframes with the data viewer, and more

-   [Environments](https://code.visualstudio.com/docs/python/environments): Automatically activate and switch between virtualenv, venv, pipenv, conda and pyenv environments

-   [Refactoring](https://code.visualstudio.com/docs/python/editing#_refactoring): Restructure your Python code with variable extraction and method extraction. Additionally, there is componentized support to enable additional refactoring, such as import sorting, through extensions including [isort](https://marketplace.visualstudio.com/items?itemName=ms-python.isort) and [Ruff](https://marketplace.visualstudio.com/items?itemName=charliermarsh.ruff). 



## Supported locales

The extension is available in multiple languages: `de`, `en`, `es`, `fa`, `fr`, `it`, `ja`, `ko-kr`, `nl`, `pl`, `pt-br`, `ru`, `tr`, `zh-cn`, `zh-tw`

## Questions, issues, feature requests, and contributions

-   If you have a question about how to accomplish something with the extension, please [ask on Stack Overflow](https://stackoverflow.com/questions/tagged/visual-studio-code+python)
-   If you come across a problem with the extension, please [file an issue](https://github.com/microsoft/vscode-python)
-   Contributions are always welcome! Please see our [contributing guide](https://github.com/Microsoft/vscode-python/blob/main/CONTRIBUTING.md) for more details
-   Any and all feedback is appreciated and welcome!
    -   If someone has already [filed an issue](https://github.com/Microsoft/vscode-python) that encompasses your feedback, please leave a 👍/👎 reaction on the issue
    -   Otherwise please start a [new discussion](https://github.com/microsoft/vscode-python/discussions/categories/ideas)
-   If you're interested in the development of the extension, you can read about our [development process](https://github.com/Microsoft/vscode-python/blob/main/CONTRIBUTING.md#development-process)

## Data and telemetry

The Microsoft Python Extension for Visual Studio Code collects usage
data and sends it to Microsoft to help improve our products and
services. Read our
[privacy statement](https://privacy.microsoft.com/privacystatement) to
learn more. This extension respects the `telemetry.enableTelemetry`
setting which you can learn more about at
https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting.
