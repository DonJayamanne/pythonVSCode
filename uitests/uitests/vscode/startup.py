# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import contextlib
import io
import logging
import os
import os.path
import tempfile
import time
import sys
from dataclasses import dataclass

from selenium import webdriver

import uitests.tools

from . import application, extension, quick_open, settings

CONTEXT = {"driver": None}


@dataclass
class Context:
    options: application.Options
    driver: webdriver.Chrome


def start(options):
    logging.debug("Starting VS Code")
    uitests.tools.empty_directory(options.workspace_folder)
    user_settings = {
        "python.pythonPath": options.python_path,
        # Log everything in LS server, to ensure they are captured in reports.
        # Found under .vscode-test/reports/user/logs/xxx/exthostx/output_logging_xxx/x-Python.log
        # These are logs created by VSC.
        "python.analysis.logLevel": "Trace",
        "python.venvFolders": ["envs", ".pyenv", ".direnv", ".local/share/virtualenvs"],
    }
    setup_user_settings(options.user_dir, user_settings=user_settings)
    return launch(options)


def launch(options):
    app_context = _start_vscode(options)
    CONTEXT["driver"] = app_context.driver
    extension.activate_python_extension(app_context)
    return app_context


def _start_vscode(options):
    application.setup_environment(options)
    driver = application.launch_vscode(options)
    context = Context(options, driver)
    # Wait for VSC to startup.
    time.sleep(2)
    return context


def reload(context):
    logging.debug("Reloading VS Code")
    # Ignore all messages written to console.
    with contextlib.redirect_stdout(io.StringIO()):
        with contextlib.redirect_stderr(io.StringIO()):
            application.exit(context)
            app_context = launch(context.options)
    context.driver = app_context.driver
    context.options = app_context.options
    CONTEXT["driver"] = context.driver
    # clear_everything(app_context)
    return app_context


def clear_everything(context):
    quick_open.select_command(context, "View: Revert and Close Editor")
    quick_open.select_command(context, "Terminal: Kill the Active Terminal Instance")
    quick_open.select_command(context, "Debug: Remove All Breakpoints")
    quick_open.select_command(context, "View: Close All Editors")
    quick_open.select_command(context, "View: Close Panel")
    quick_open.select_command(context, "Notifications: Clear All Notifications")


def reset_workspace(context):
    if sys.platform.startswith("win"):
        # On windows, create a new folder everytime.
        # Deleting/reverting changes doesn't work too well.
        # We get a number of access denied errors (files are in use).
        setup_workspace(context, getattr(context, "workspace_repo", None))
        workspace_folder = context.options.workspace_folder
    else:
        # On non-widows, just revert the changes made using git (easy).
        workspace_folder = context.options.workspace_folder
        if getattr(context, "workspace_repo", None) is None:
            uitests.tools.empty_directory(workspace_folder)
        else:
            logging.debug(f"Resetting workspace folder")
            uitests.tools.run_command(
                ["git", "reset", "--hard"], cwd=workspace_folder, silent=True
            )
            uitests.tools.run_command(
                ["git", "clean", "-fd"], cwd=workspace_folder, silent=True
            )

    settings_json = os.path.join(workspace_folder, ".vscode", "settings.json")
    settings.update_settings(settings_json)


def setup_workspace(context, source_repo=None):
    """
    Set the workspace for a feature/scenario.
    source_repo is either the github url of the repo to be used as the workspace folder.
        Or it is None.
    """
    context.workspace_repo = source_repo
    if source_repo is None:
        if sys.platform.startswith("win"):
            try:
                uitests.tools.empty_directory(context.options.temp_folder)
            except (PermissionError, FileNotFoundError, OSError):
                pass
            # On windows, create a new folder everytime.
            # Deleting/reverting changes doesn't work too well.
            # We get a number of access denied errors (files are in use).
            workspace_folder_name = os.path.basename(
                tempfile.NamedTemporaryFile(prefix="workspace folder ").name
            )
            context.options.workspace_folder = os.path.join(
                context.options.temp_folder, workspace_folder_name
            )
            os.makedirs(context.options.workspace_folder, exist_ok=True)
            settings_json = os.path.join(
                context.options.workspace_folder, ".vscode", "settings.json"
            )
            settings.update_settings(settings_json)
        else:
            uitests.tools.empty_directory(context.options.workspace_folder)
        return

    logging.debug(f"Setting up workspace folder from {source_repo}")

    if sys.platform.startswith("win"):
        # On windows, create a new folder everytime.
        # Deleting/reverting changes doesn't work too well.
        # We get a number of access denied errors (files are in use).
        try:
            uitests.tools.empty_directory(context.options.temp_folder)
        except (PermissionError, FileNotFoundError, OSError):
            pass
        workspace_folder_name = os.path.basename(
            tempfile.NamedTemporaryFile(prefix="workspace folder ").name
        )
        context.options.workspace_folder = os.path.join(
            context.options.temp_folder, workspace_folder_name
        )
        os.makedirs(context.options.workspace_folder, exist_ok=True)

    # If on non-windows, just delete the files in current workspace.
    uitests.tools.empty_directory(context.options.workspace_folder)
    target = context.options.workspace_folder
    repo_url = _get_repo_url(source_repo)
    uitests.tools.run_command(["git", "clone", repo_url, "."], cwd=target, silent=True)

    # Its possible source_repo is https://github.com/Microsoft/vscode-python/tree/master/build
    # Meaning, we want to glon https://github.com/Microsoft/vscode-python
    # and want the workspace folder to be tree/master/build when cloned.
    if len(source_repo) > len(repo_url):
        # Exclude trailing `.git` and take everthying after.
        sub_directory = source_repo[len(repo_url[:-4]) + 1 :]
        context.options.workspace_folder = os.path.join(
            context.options.workspace_folder, os.path.sep.join(sub_directory.split("/"))
        )

    settings_json = os.path.join(target, ".vscode", "settings.json")
    settings.update_settings(settings_json)


def _get_repo_url(source_repo):
    """Will return the repo url ignoring any sub directories."""

    repo_parts = source_repo[len("https://github.com/") :].split("/")
    repo_name = (
        repo_parts[1] if repo_parts[1].endswith(".git") else f"{repo_parts[1]}.git"
    )
    return f"https://github.com/{repo_parts[0]}/{repo_name}"


def setup_user_settings(user_folder, **kwargs):
    folder = os.path.join(user_folder, "User")
    os.makedirs(folder, exist_ok=True)
    settings_json = os.path.join(folder, "settings.json")
    user_settings = kwargs.get("user_settings", None)
    if user_settings is not None:
        settings.update_settings(settings_json, user_settings)
