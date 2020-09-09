# Requirements

-   Separate extension in marketplace
-   Easily discoverable extension in marketplace for running DS or Jupyter for any language
-   Seamless experience for existing users of Python extension (Updating to new Python extension without DS extension)
    -   DS functionality should work without a hitch & without any user intervention.
    -   DS extension must be automatically installed for existing users.
    -   All of the users settings & the like must be migrated to new extension
-   All of the following features must exist in new DS extension
    -   Telemetry,
    -   Experiments (new experiments framework)
    -   Insiders extension
    -   All of the existing DS functionality must exist & work in new DS extension
-   Python is not required to run non-Python kernels
    -   Installing new extension to run Julia, should not have to install Python runtime.
-   Almost zero DS related code in Core extension
-   Follow easiest path to splitting extension
    -   Hence copy most of the Python extension code across - technical details covered later.

# Extension dependencies

-   Python extension will depend on DS Extension
    -   Users updating/installing the Python extension will automatically get the DS extension
-   DS extension will not depend on Python Extension

# Release

-   Coordinate release between Python, DS, AML & Gather extensions (Gather & AML need to update extension id to point to new DS extension)
-   Breaking API changes must be first deprecated in one release & deleted in the next (i.e. 1 month apart).
    -   Don't need to formalize, but we need to have a verbal agreement on some process.

# Assumptions

-   GitHub Issues will be migrated to the new repo
    -   We will have an automated tool to transfer the issues.
-   We will use the same telemetry App Key
-   This extension split will not be an experiment
    -   If required, users can uninstall new extension(s) & install old Python extension
-   Rarely would `raw kernel` not work
    -   In such an instance `jupyter` is required to start the kernel. As a result `python` is now a requirement on user machine.
    -   Python is used to search, install, launch `Jupyter`
-   Python extension exposes API specifically for this new DS extension
    -   API exposed just to DS extension (lower maintenance).
-   We copy everything to new DS extension
    -   We will delete stuff over time & add necessary API in core extension.
    -   E.g. Daemon, & other python code will be copied across.
    -   Code related to Launching LS for Notebooks & the like will stay in DS extension.
-   Zero impact on the new Coding Pack Python installer.
    -   As DS is a dependency, it will get pulled down & installed by VSC.
    -   If we want to track whether DS extension was installed by Coding Pack, then we will need to make changes to coding pack.

# Core extension APIs (Technical)

-   Already have a prototype for this (very simple)
-   We will add the API as we need them
-   The goal for now is to add APIs specifically for DS extension. Core extension will use DS API to provide DS extension some API points.
    -   This way, this API is specific to DS & no one else can use it.
    -   Lower maintenance, we can change this as we see fit.
-   We have some API at this stage:
    -   List of interpreters, get interpreter information, activated env vars, interpreter change event, install packages, etc.
    -   Get debugger, & LS paths (so that core team can ship debugger & LS).
-   Again, we can afford to create very coarse grained API.
    -   E.g. expose IInterpreterService (we don't need IOC, FS, etc).
    -   Note: We only need a class that implements methods such as get interpreters, etc..
    -   Slowly we can create more fine grained API.

# Changes to Core extension

-   Ship new DS extension as a dependency.
-   Release will have to be coordinated with new Extension (more on this later)
-   Delete DS code
-   Release Management (Insider & Stable)
    -   Both Python & DS extensions cannot release breaking changes, not even in insiders version.
    -   This is a no-brainer & easy to solve.
    -   Do not remove or change existing API without having a corresponding DS extension published. (best to first deprecate in one release, then remove in next release).
-   When clauses will still need to keep the context variables used in DS extension
    -   Over time we can create an API for DS to update the context vars used in Python extension.
-   Integration with DS extension
    -   Sending stuff to interactive window (run line in terminal, etc).
    -   Today DS code highjacks core extension functionality, we need to do this via an API.
-   Installation of packages such as pandas, ipykernel & the like will remain in core extension
    -   Basically Python extension exposes ability to install a package.
-   Update/remove DS GitHub issue template

# Migration notes

-   Telemetry? See `Telemetry` section
-   Commands/Keyboard shortcuts
    -   If users have customized the keyboard shortcuts for some of the DS commands, we'll need to migrate them (if possible).
-   User settings
    -   We have done this a lot in the past, should be straight forward.
    -   Note: Must be done without prompts.
-   User & workspace level storage (memento)
    -   Information stored in the global/workspace memento should be migrated.
    -   Can be achieved easily. Multiple solutions (core extension API or work around).
-   Trusted notebooks
    -   Information related to trusted notebook is stored in file under extension folder. We need to take this into account.
    -   Can be achieved easily. Multiple solutions (core extension API or work around).
-   Experiments
    -   Best solution is to just end experiments and start new ones in new extension
    -   If we can share experiments between two extensions, then great.
    -   I don't think we have any `running` experiments (turn on custom editor after split).

# Estimates (~20 days)

-   Setup Repo, component governance, readme, etc - 1 day
    -   Copy entire python extension & setup everything.
-   Remove redundant code, Renaming settings, commands & the like in code - 4 days
    -   We need to ensure this doesn't break things (commands, settings, localized vars).
    -   Delete redundant code, tests & the like.
    -   We have links that are hard coded to the Python repo (readme, experiments, etc).
-   API
    -   API will evolve/change over time. Release 1, we have very simple & coarse API.
    -   API in core extension - 1 days
        -   Interpreters, installation of packages, etc.
        -   Expose memento, trust info, path to debugger, jedi, etc.
        -   We're only exposing existing stuff (not writing new code).
    -   API code in DS extension - 1 day
        -   Super easy.
        -   Build as we need, i.e. over time we'll add more API to remove code from DS extension so that we rely on Python extension to do more of the work.
    -   Integration with Python extension using their API - 2 days
        -   Integrate to get interpreters, etc.
        -   Spawning python processes, daemons, etc will stay in new DS extension for now.
        -   Spawning Jedi, LS & the like will stay in new DS extension for now.
        -   For CI (functional) tests, we can move Python code to enumerate interpreters & get interpreter info into tests folder (this way tests will work without Python extension).
-   Sending selection to interactive window - 1 day
    -   Need API at both ends
    -   For now we can update the context vars & Python will pick these up automatically (as these context vars are global to VS Code).
-   Update startup code to not perform Python specific stuff - 2 days
    -   We have startup code that prewarms daemon pools, looks for kernels in interpreters & the like.
    -   Such code will need to be deferred (e.g. if you don't have Python & using just Julia, why run Python code on startup)
-   Migrations
    -   User settings - 2 days
    -   Trusted notebooks - 2 hours
    -   Global/workspace memento - 2 hours
-   AML Extension - 0.5 day (probably done by other team & they might have their own estimate)
    -   Rely on the new DS extension
    -   Use API from DS extension.
-   Core extension changes - 2 days (probably done by other team & they might have their own estimate)
    -   Delete DS code & hook up API to communicate with DS extension for run line in interactive, etc
    -   Ensure DS extension is a dependency (only during build)
    -   Update build phase to include DS as extension dependency
    -   Update smoke test if required (are we installing VSIX, if so, then we need to install DS extension)
-   Setup Azure, Release (insiders) Pipelines - 1 day
    -   We can always release to marketplace manually (I'm not concerned about getting that done ASAP).
-   Update existing Python bot to move GitHub issues to new repo - 1 day
    -   Use Bot to move existing issues to the new repo.
    -   The same bot/code will be used to automatically move new issues to the new Repo (core extension authors add appropriate label & issue gets moved automatically).

# Technical details

-   When working with old notebooks, interactive window & non-native notebook functionality in DS extension
    -   We must expect python extension to be active.
    -   This is a safe & easy assumption (event today Python extension has to load for this to work in old code).
    -   This way, all of the API has been initialized & easier to work.
-   Retrieving memento is synchronous, hence assumption is Python extension is active when
    -   This should be easy enough.
    -   We're using interactive window
    -   We're using old notebooks
