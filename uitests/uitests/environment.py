# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os.path
import sys

import behave
import parse
from selenium.common.exceptions import WebDriverException

import uitests.tools
import uitests.vscode
import uitests.vscode.settings
import uitests.vscode.startup


@parse.with_pattern(r"\d+")
def parse_number(text):
    return int(text)


behave.register_type(Number=parse_number)
feature_workspace_folder = None


@uitests.tools.retry((TimeoutError, WebDriverException), tries=5, delay=5)
@uitests.tools.log_exceptions()
def before_all(context):
    try:
        options = uitests.vscode.application.get_options(**context.config.userdata)
        app_context = uitests.vscode.startup.start(options)
        uitests.vscode.startup.clear_everything(app_context)
        context.driver = app_context.driver
        context.options = app_context.options
        context.workspace_repo = None
    except (TimeoutError, WebDriverException):
        # Exit before we retry again.
        uitests.vscode.application.exit(context)
        # Use the driver we defined in startup.
        _exit(context)


def after_all(context):
    _exit(context)


def _exit(context):
    context.driver = uitests.vscode.startup.CONTEXT["driver"]
    uitests.vscode.application.exit(context)
    uitests.vscode.startup.CONTEXT["driver"] = None


@uitests.tools.retry((AttributeError, PermissionError, FileNotFoundError), tries=2)
@uitests.tools.log_exceptions()
def before_feature(context, feature):
    # Restore `drive`, as behave will overwrite with original value.
    # Note, its possible we have a new driver instance due to reloading of VSC.
    context.driver = uitests.vscode.startup.CONTEXT["driver"]
    if context.driver is not None:
        uitests.vscode.startup.clear_everything(context)

    repo = [
        tag for tag in feature.tags if tag.lower().startswith("https://github.com/")
    ]
    uitests.vscode.startup.setup_workspace(context, repo[0] if repo else None)
    global feature_workspace_folder
    feature_workspace_folder = context.options.workspace_folder

    # On windows, always reload, as we'll have a new worksapce folder for every feature.
    #   If we have a repo, then we might have a new workspace folder, so just reload.
    # Also reloading helps avoid flakyness of selenium (on any OS - seen on CI).
    # if sys.platform.startswith("darwin") or repo:
    uitests.vscode.startup.reload(context)


@uitests.tools.retry((PermissionError, FileNotFoundError), tries=2)
@uitests.tools.log_exceptions()
def before_scenario(context, scenario):
    # Restore `drive`, as behave will overwrite with original value.
    # Note, its possible we have a new driver instance due to reloading of VSC.
    context.driver = uitests.vscode.startup.CONTEXT["driver"]

    context.options = uitests.vscode.application.get_options(**context.config.userdata)
    context.options.workspace_folder = feature_workspace_folder

    # Restore python.pythonPath in user & workspace settings.
    settings_json = os.path.join(context.options.user_dir, "User", "settings.json")

    uitests.vscode.settings.update_settings(
        settings_json, {"python.pythonPath": context.options.python_path}
    )

    # Flaky issues, ensure VSC is loaded.
    if context.driver is None:
        uitests.vscode.startup.reload(context)

    # We want this open so it can get captured in screenshots.
    uitests.vscode.quick_open.select_command(context, "View: Show Explorer")
    uitests.vscode.startup.clear_everything(context)
    if "preserve.workspace" not in scenario.tags:
        uitests.vscode.startup.reset_workspace(context)

        # On windows, always reload, as we create a new workspace folder.
        if sys.platform.startswith("win"):
            uitests.vscode.startup.reload(context)


@uitests.tools.log_exceptions()
def after_scenario(context, feature):
    context.driver = uitests.vscode.startup.CONTEXT["driver"]
    uitests.vscode.notifications.clear(context)


@uitests.tools.log_exceptions()
def after_step(context, step):
    context.driver = uitests.vscode.startup.CONTEXT["driver"]
    if step.exception is not None:
        uitests.vscode.application.capture_screen(context)
