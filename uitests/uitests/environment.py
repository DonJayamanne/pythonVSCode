# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import os.path
import sys

import behave
import parse

import uitests.tools
import uitests.vscode
import uitests.vscode.settings
import uitests.vscode.startup


@parse.with_pattern(r"\d+")
def parse_number(text):
    return int(text)


behave.register_type(Number=parse_number)
feature_workspace_folder = None


def before_all(context):
    options = uitests.vscode.application.get_options(**context.config.userdata)
    app_context = uitests.vscode.startup.start(options)
    uitests.vscode.startup.clear_everything(app_context)
    context.driver = app_context.driver
    context.options = app_context.options
    context.workspace_repo = None


def after_all(context):
    context.driver = uitests.vscode.startup.CONTEXT["driver"]
    uitests.vscode.application.exit(context)


def write_log_header(message, options):
    pass
    # with open(os.path.join(options.logfiles_dir, "vsc.log"), "a+") as fp:
    #     fp.write(os.linesep)
    #     fp.write(message)
    #     fp.write(os.linesep)


@uitests.tools.retry((PermissionError, FileNotFoundError), tries=2)
def before_feature(context, feature):
    # Restore `drive`, as behave will overwrite with original value.
    # Note, its possible we have a new driver instance due to reloading of VSC.
    context.driver = uitests.vscode.startup.CONTEXT["driver"]
    uitests.vscode.startup.clear_everything(context)
    write_log_header(feature.name, context.options)

    repo = [
        tag for tag in feature.tags if tag.lower().startswith("https://github.com/")
    ]
    uitests.vscode.startup.setup_workspace(context, repo[0] if repo else None)
    global feature_workspace_folder
    feature_workspace_folder = context.options.workspace_folder

    # On windows, always reload, as we'll have a new worksapce folder for every feature.
    # If we have a repo, then we might have a new workspace folder, so just reload.
    # Can optimize later (for non-windows).
    if sys.platform.startswith("darwin") or repo:
        uitests.vscode.startup.reload(context)


@uitests.tools.retry((PermissionError, FileNotFoundError), tries=2)
def before_scenario(context, scenario):
    # Restore `drive`, as behave will overwrite with original value.
    # Note, its possible we have a new driver instance due to reloading of VSC.
    context.driver = uitests.vscode.startup.CONTEXT["driver"]
    context.options = uitests.vscode.application.get_options(**context.config.userdata)
    context.options.workspace_folder = feature_workspace_folder
    write_log_header(scenario.name, context.options)

    # Restore python.pythonPath in user & workspace settings.
    settings_json = os.path.join(context.options.user_dir, "User", "settings.json")

    uitests.vscode.settings.update_settings(
        settings_json, {"python.pythonPath": context.options.python_path}
    )

    # We want this open so it can get captured in screenshots.
    uitests.vscode.quick_open.select_command(context, "View: Show Explorer")
    uitests.vscode.startup.clear_everything(context)
    if "preserve.workspace" not in scenario.tags:
        uitests.vscode.startup.reset_workspace(context)

        # On windows, always reload, as we create a new workspace folder.
        if sys.platform.startswith("win"):
            uitests.vscode.startup.reload(context)


def after_scenario(context, feature):
    context.driver = uitests.vscode.startup.CONTEXT["driver"]
    uitests.vscode.notifications.clear(context)


def after_step(context, step):
    context.driver = uitests.vscode.startup.CONTEXT["driver"]
    if step.exception is not None:
        uitests.vscode.application.capture_screen(context)
