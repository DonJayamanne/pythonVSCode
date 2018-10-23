# Extension, requirements, dev requirements, etc
* One stop shop for Python Development (debugging, linting, refactoring, etc).
* Mac, Linux, Windows
* Dev requirements, Nodejs, Python, any OS

# Types of VSC Extensions
* Language Extensions
* Snippets
* Themes
* Extension Packs

# Directory Structure
* Extension Build
    * Open VSIX (its just a zip file)
    * All files in root directory minus files excluded from `.gitignore`
    * Only new folder is the `out` directory
    * How to control what files get included, excluded
        * Everyting in `root` directory are included, you need to be specific about what to exclude
        * Look at `.vscodeignore` (similar to `.gitignore`)
* Source
    * `src` is where all source files sit
        * `client`  - This is where the source for the extension resides
        * `server`  - This is where we have a dummy file. In the past VSC extensions required this folder, and this file. The extension no longer requires this.
                        My guess is they have relaxed file requirements, and there have been numerous extensions.
                        One thing we probably should do is, remove this folder.
        * `test`    - Source for all tests (`unit`, `system`, `integration`, `functional` tests, all tests).
                    - We have 2 types of tests:
                        * Unit tests - Everything is completely mocked (including VS Code)
                        * Inetgration/System/Functional tests - Tests run with full acess to VS Code. We can setup a workspace, open files, editor windows, etc.
                        To my knowledge we're the only extension with unit tests where we mock VS Code, everyone else is running against VS Code (writing `functional` tests).
                        This is very slow.
                        In fact we're the only extension with an extensive set of tests (other extensions don't have as many tests as we do).
                        This is partly because we're one of the largest if not the largest extension (in terms of feature set + code base).
                        Azure extensions are all broken up.
        * `testMultiRootWkspc`  - Work spaces and workspace folders that are loaded in VS Code for testing.
                        Think of this directory as saample python files, VS Solutions and projects that can be loaded in VS, but here these are specific to VSC.
                        We have work space files.
                        So, what do we put here, if we need more files or setup a workspace with specific settings (in `settings.json`), then this is where we'd do it.
    * `.github`     - Folder with Github specific files (used for issue templates and the like).
    * `.vscode`     - If you don't know this, you haven't used VS Code enough. Who doesn't know this?
                        Explain it.
    * `news`        - Used to store readme files that describe each PR. Used to build our release notes (summarizing the PRs).
    * `images`      - Image files (used for *.md files or extension)
    * `resources`   - Other resource files.
    * `snippets`    - Code snippets
    * `syntaxes` & `languages`   
    * `tpn`         - Scripts for generation of `Third Part Notices (tpn)`
    * `typings`     - TypeScript definition files (used to provide intellisense for javascript files tha we don't have intellisense for).
    * `package.nls.*.json`  - Localization files used by VS Code for `Commands`, (commands displayed in the Command Palette, and defined in `package.json`)

# Development
## Quick Started
* Steps
    * Clone
    * npm i
    * code .
    * Build (`ctrl+shift+build`)
    * Select `compile`

## Debugging
* Start debugging `Extension`
* 
## Code quality
* There were no checks in place to ensure code met certain guidelines before commiting the code.
* Last year we introduced some checks to ensure code quality is met prior to checkin (implemented via `pre-commit` hooks).
* We couldn't fix the code base as there were too many issues to resolve back then, I believe over 1700 issues. 
* The plan was to validate the code as changes are made to existing files or to new files. This way we chip away at old code as and when modified.
* Drawbacks: Slower commits (on Windows)
* Pre-commit hooks:
    * Runs linters to ensure ccode meets certain standards
    * TS compiler checks again
    * Pre-formatter (was later removed)
* We now have a PR that will move all of this onto the CI Server
    * Hopefully this will mean faster commits, but you'll need to monitor the CI server to view errors previously reported via pre-commit hooks
    * You can optionally run `npm gulpfile.js` or `Hygiene` Gulp task
    * You can also use `Hygiene-Watch` Gulp task, that'll run in the background, but very slow in Windows.
## Guide lines
* Use `Interfaces` when implementing interfaces. Use `types` when defining structures.
* Use `enums` with names where possible. Use `enums` with numbers when using `flags`.
* Use decorators for `logging`, `telemetry` and other similar cross cutting concerns.
    `@traceVerbose`, `@captureTelemetry`, `@swallowExceptions`, `@skipIfTest`, etc.
* Add logging and telemetry for all new code/functionality (right now that's one area the extension needs significant improvement).
* Use DI (this makes it easier to write tests), and we have numerous cases where we use DI for other than testing.
* CI will ensure code meets required guidelines prior to commit.
* I prefer to use `pre-commit` hooks (fast on a Mac 😉).
* Always remember code can be executed in 3 types of environments, no workspaces single workspace or multiple workspaces. Thus when running any python code, retrieving any settings or similar remember to access settings in the extension using the `resource` (`URI` of the editor).



# Tests
## Folder structure
* Files go into `src/tests`.
* File names and directories match the corresponding source file in the `src/client` directory.
## Unit tests
* These tests run without VS Code, or any other dependencies, we mock everything possible in here.
* Files naming convention `*.unit.test.ts`
* These tests run very fast, in a few seconds.
* Running:
    * From the command palette select `Tasks: Run Task`
    * Next select `Run Unit Tests`
* Running a specific unit test:
    * Modifiy `package.json`
    * Update `scripts` section as follows where `xyz` contains the name or part of the test suite.
    *  `"test:unittests": "node ./out/test/unittests.js grep='xyz'",`
    * Run tests again
* Debugging:
    * From the debug menu select `Unit Tests (without VS Code, *.unit.test.ts)`
    * Start debugging
    * You can add breakpoints.
* Debugging a specific unit test:
    * Modifiy `launch.json`
    * Update `"grep=xyz"` section in the `Unit Tests (without VS Code, *.unit.test.ts)` debug configuration.
    *  `"test:unittests": "node ./out/test/unittests.js grep='xyz'",` where `xyz` contains the name or part of the test suite.
    * Debug once again.
* Similarly we have separate configurations for `Single Workspace`, `Multiroot`, `Debugger` or `Language Server`.
    * These configurations can be used for running/debugging tests.
## Functional/System/Integration tests
* All other tests run in a few minutes ()
* Files naming convention `*.unit.test.ts`.
* If you want to run a test in a single workspace, skip tests if the constant `IS_MULTI_ROOT_TEST` is `true`.
* If you want to run a test in a mult-root workspace, skip tests if the constant `IS_MULTI_ROOT_TEST` is `false`.
* If you want to run a test in a debugger environment, skip tests if the constant `TEST_DEBUGGER` is `false`.
## Single Workspace
* A single folder is opened in VS Code and tests run under this environment (single workspace folder).
## Multroot Workspace
* Multiple folder are opened in VS Code, you achieve this by opening a `Workspace` in VSC.
* We run all tests that run under `Single Workspace` here along with a couple of additional tests written specifically for `multi folder` scenarios.
## Debugger Tests
* These are functional debugger tests.

# Procecesses
## Arbitrary Process
* Make use of the `IProcessServiceFactory.create` method to create a concrete instance of `IProcessService`.
* Why use this class?
    * Takes care of environment variables, and the like.
    * Provides the ability to wait for the response, get an observable list (stream the responses).
    * etc.
## Spawning Python, executing Python code, modules, etc
* Make use of the `IPythonExecutionFactory.create` method to create a concrete instance of `IPythonExecutionService`.
* Why use this class?
    * User could have a multiroot workspace, each workspace could have a different python interpreter.
    * You as a developer don't need to try to figure out the path to the python interpreter.
    * There are other factors to be considered (environment variables).
    * Provides the ability to wait for the response, get an observable list (stream the responses).
    * etc.
## Guidelines
* Always use `IProcessServiceFactory` or `IPythonExecutionFactory` when spawning any process.
* Killing a procecss cacn be done using `ProcessService.kill`
* Checking whether a process is alive `ProcessService.isAlive`
* Access current procecss can be done via `ICurrentProcess` (again abstracted for testing).

# Extension Configuration Settings
## IConfigurationService
* Use this class to get/set settings related to the extension
* Why not use VSC API, simple, its too verbose and not strongly typed. 
* If you modifiy/rename a setting or there's a typo, there's not validation, nothing to protect you. Hence the idea to create this class (basically its a `singleton` that gets udpated when ever user updates any settings).
## Guidelines
* Always use `IConfigurationService` to access and update Python Extension specific settings.
* Use `VSC` api sparingly, to ensure we can run our `unit tests`, if usig `VSC` api, then use the `IWorkspaceService` interface to get access to the VSC Configuration settings object.
* Using VSC configuration settings API can be a pain point, as this API has had numerous bugs in the past few months (I believe at least 4 times) that have brought down our CI (excellent reason for `unit tests`).

# Python Module Installers
* As we support multiple environments, we need to support multiple ways of installing python packages in each of the supported environments.
* We need to install packages when dealing with linters, formatters and the like.
* Today we have three ways of installing Python Packages, `Conda`, `Pip Env` and the standard `Pip` installation.
* We have 3 classes all implementing the `IModuleInstaller` interface.
* The `IInstallationChannelManager` interface is basically a factory class that you use to create an instance of the installer. This will determine the type of the installer based on the resource (using that information to determine the type of the Environment selected).
* In some cases, more than one installer can be available, at which point we display a prompt to the user.

# User Environment Diagnostics
* Over the past few months we've learnt theres a need to validate the users environments, settings or similar to ensure the proper functioning of the extension.
* E.g. if installing the extension on a clean Mac environment, the default Python Environment on the Mac is not supported by the Extension, then:
    * We need to convey this message to the user
    * Provode user with options|links to get more information about this.
    * Provider user with links to download a version of Python supported by the extension
    * Dismiss the message
    * Dismiss the message permanently (i.e. never display this again)
* We call these checks, `diagnostic` checks, and they are defined under `src/client/application/diagnostics/checks` folder.
* Each diagnostic check implements the `IDiagnosticsService` returning a list of `diagnostic` messages that can be actioned.
* The classes under `src/client/application` provide all of the functionality for:
    * Displaying messages with option to ignore this message
    * Options in messages with links
    * Options in messages that in turn invoke VSC Commands
    * Etc.
## Guidelines
* Any diagnostics (validations with user input) should be placed in here.
* Generally all diagnostics are run once when the extension loads.
* How ever you can chose to run specific diagnostics manually as well. E.g. validating the Python Interpreter when debugging.
* The plan is to add more `checks` into this section that will help users with getting started with the extension. E.g. ensure their environment is configured properly (by displayig appropriate prompts with suggestions where nececssary).

# Using VSC API
* We do not use VSC API Directly to facilitate testing.
* All VSC API is hidden behind interfaces, these intrefaces are defined in `src/client/common/application`.
* If accessing any VSC API, please look at the interfaces in here before creating anything new.

# Interpreters (Python Environments)
* Code related to discovery & identification of Python Environments is located in `src/client/interpreters`.
* Today we support multiple types of environments (interpreter locations) `Conda`, `PipEnv`, `PyEnv`, `VirtualEnv`, `Venv`, and others.
* If a Python Environment is stored in a common known location, we'd either add a new class or modify one of the existing classes in `src/client/interpreters/locators/services` (interface is `IInterpreterLocatorService`). Recently I learnt that RTVS and PTVS (tests) do something very similar.
* Each concrete class implements the `IInterpreterLocatorService` interfacce and inherits from `CacheableLocatorService` class. This provides the ability to cache the list of environments discovered by that specific class.
* This is very useful in speeding up interpreter discovery within the Extension. For instance on Windows, it take take over 30s to discover all Python Environments (one of the major culprit is `Conda`). So, while the list of interpreters are being built in the background, the previously cached list of interpreters will be returned and displayed to the user.
## Guidelines
* Use `IInterpreterService` when dealing with Python Environments.
    * `getInterpreters` returns a list of all known interperters.
    * `getActiveInterpter` returns the current interpreter (associated with the workspace).
    * `getInterpreterDetails` returns details for a specific python interpreter.
    * etc

# Commont/Core/Helper Utilities
* Network related functionality can be found in `src/client/common/net`
* Platform/OS related functionality can be found in `src/client/common/platform`
* Platform/OS related functionality can be found in `src/client/common/platform`
* For state store (global or workspace cache) use `IPersistentStateFactory` (optionally with expiry).

# Deep Dive
## Downloading Language Server
* Requirements
    * Multiple download channels (stable, beta, daily).
    * Download from Nuget store or Blob Store (or other).
    * Download latest version of language server if available.
    * Use appropriate download channel based on version of extension.
* Design Decisions
    * Multile download channels = multiple classes
    * Multiple download locations (nuget, azure blob store, etc) = multiple classes
    * Multiple implementations = DI with named implementations (class DI solution in .NET, Java, etc).
    * Logging for new code
    * Use `semver` package when dealing with versions.
    *  
# General Guidelines
* Always create unit tests `*.unit.test.ts`.
* Import modules on demand using `require` (this speeds up loading of the extension).
* Add Telemetry for anything new (consider using the decorators).
* Add logging for anything new.
* We'll need integration tests only in select few cases (use your judgement when you need functional/unit tests).
* If creating functional, do so only after we have created `unit tests` (i.e. `unit tests` always take precedence).
* Run functional/integration tests on CI Server (if you want to run them locally, this can be done easily but requires a little experience and simpe setup.).
    * Setup a virtual environment.
    * Install all python dependencies (`requirements.txt`)
    * Add the setting `"env":{ CI_PYTHON_PATH : "<fully qualified path to Python executable>"}` to `launch.json`.
    * Start debugging.


Lay off the land – the directory structure and layout of the repo. What’s in key files, especially if it’s not intuitively obvious. This is more for me and AI team.
Dependencies – what and why
Key design decisions
Key scenarios end to end – pick a few things the extension does and walk through them.
What’s left – the key scenarios should have covered a fair amount of the code. Discuss in a bit more detail (than step 1) the stuff that wasn’t covered
Telemetry – what we measure, why and how
Tests. Focus here is on what a person unfamiliar to the code might be able to learn from reading the tests, and how to test new functionality
