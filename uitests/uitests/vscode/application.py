# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.


import base64
import contextlib
import io
import os
import os.path
import shutil
import stat
import sys
import tempfile
import traceback
from dataclasses import dataclass

from selenium import webdriver

import psutil
import uitests.bootstrap
import uitests.report
import uitests.tools

# from . import quick_open


@dataclass
class Options:
    channel: str
    executable_dir: str
    user_dir: str
    extensions_dir: str
    extension_path: str
    workspace_folder: str
    temp_folder: str
    screenshots_dir: str
    embed_screenshots: bool
    output: str
    python_path: str
    python_type: str
    python_version: str
    python3_path: str
    pipenv_path: str
    logfiles_dir: str
    conda_path: str


def get_options(
    destination=".vscode-test",
    vsix="ms-python-insiders.vsix",
    embed_screenshots=True,
    output="file",
    channel="stable",
    python_path=sys.executable,
    python_type=None,
    python_version=f"{sys.version_info[0]}.{sys.version_info[1]}",
    python3_path=sys.executable,
    pipenv_path=None,
    conda_path="conda",
):
    """Gets the options used for smoke tests."""
    embed_screenshots = (
        embed_screenshots == "True"
        if type(embed_screenshots) is str
        else embed_screenshots
    )

    destination = os.path.abspath(destination)
    options = Options(
        channel,
        os.path.join(destination, channel),
        os.path.join(destination, "user"),
        os.path.join(destination, "extensions"),
        vsix,
        os.path.join(destination, "workspace folder"),
        os.path.join(destination, "temp"),
        os.path.join(destination, "screenshots"),
        embed_screenshots,
        output,
        python_path,
        python_type,
        python_version,
        python3_path,
        pipenv_path,
        os.path.join(destination, "logs"),
        conda_path,
    )
    os.makedirs(options.extensions_dir, exist_ok=True)
    os.makedirs(options.user_dir, exist_ok=True)
    os.makedirs(options.workspace_folder, exist_ok=True)
    os.makedirs(options.temp_folder, exist_ok=True)
    os.makedirs(options.screenshots_dir, exist_ok=True)
    os.makedirs(options.logfiles_dir, exist_ok=True)
    return options


def setup_environment(options):
    """Setup environment for smoke tests."""
    # Required for chrome driver.
    os.environ["PATH"] += os.pathsep + options.executable_dir
    # Ensure PTVSD logs are in the reports directory,
    # This way they are available for analyzing.
    os.environ["PTVSD_LOG_DIR"] = options.logfiles_dir
    # Log extension stuff into vsc.log file.
    os.environ["VSC_PYTHON_LOG_FILE"] = os.path.join(options.logfiles_dir, "vsc.log")


def uninstall_extension(options):
    """Uninstalls extensions from smoke tests copy of VSC."""
    shutil.rmtree(options.extensions_dir, ignore_errors=True)


def install_extension(options):
    """Installs extensions into smoke tests copy of VSC."""
    _set_permissions(options)
    uninstall_extension(options)
    bootstrap_extension = uitests.bootstrap.main.get_extension_path()
    _install_extension(options.extensions_dir, "bootstrap", bootstrap_extension)
    _install_extension(
        options.extensions_dir, "pythonExtension", options.extension_path
    )


def _set_permissions(options):
    # Set necessary permissions on Linux to be able to start.
    # Else selenium throws errors.
    # & so does VSC, when accessing vscode-ripgrep/bin/rg.
    if sys.platform.startswith("linux"):
        binary_location = _get_binary_location(options.executable_dir, options.channel)
        file_stat = os.stat(binary_location)
        os.chmod(binary_location, file_stat.st_mode | stat.S_IEXEC)

        rg_path = os.path.join(
            os.path.dirname(binary_location),
            "resources",
            "app",
            "node_modules.asar.unpacked",
            "vscode-ripgrep",
            "bin",
            "rg",
        )
        file_stat = os.stat(rg_path)
        os.chmod(rg_path, file_stat.st_mode | stat.S_IEXEC)


def _install_extension(extensions_dir, extension_name, vsix):
    """Installs an extensions into smoke tests copy of VSC."""
    temp_dir = os.path.join(tempfile.gettempdir(), extension_name)
    uitests.tools.unzip_file(vsix, temp_dir)
    shutil.copytree(
        os.path.join(temp_dir, "extension"),
        os.path.join(extensions_dir, extension_name),
    )
    shutil.rmtree(temp_dir, ignore_errors=True)


def launch_vscode(options):
    """Launches the smoke tests copy of VSC."""
    chrome_options = webdriver.ChromeOptions()
    # Remember to remove the leading `--`.
    # Chromedriver will add `--` for ALL arguments.
    # I.e. arguments without a leading `--` are not supported.
    for arg in [
        f"user-data-dir={options.user_dir}",
        f"extensions-dir={options.extensions_dir}",
        f"folder-uri=file:{options.workspace_folder}",
        "skip-getting-started",
        "skip-release-notes",
        "sticky-quickopen",
        "disable-telemetry",
        "disable-updates",
        "disable-crash-reporter",
    ]:
        chrome_options.add_argument(arg)

    chrome_options.binary_location = _get_binary_location(
        options.executable_dir, options.channel
    )
    driver = webdriver.Chrome(options=chrome_options)
    return driver


def exit(context):
    # Ignore all messages written to console.
    with contextlib.redirect_stdout(io.StringIO()):
        with contextlib.redirect_stderr(io.StringIO()):
            pid = 0
            try:
                pid = context.driver.service.process.id
            except Exception:
                pass
            try:
                context.driver.close()
            except Exception:
                pass
            try:
                context.driver.quit()
            except Exception:
                pass
            try:
                if pid != 0:
                    psutil.Process(pid).terminate()
            except Exception:
                pass
            try:
                # Clear reference.
                context.driver = None
            except Exception:
                pass


def capture_screen(context):
    if context.options.output != "file":
        return

    if context.options.embed_screenshots:
        screenshot = context.driver.get_screenshot_as_base64()
        uitests.report.PrettyCucumberJSONFormatter.instance.attach_image(screenshot)
    else:
        filename = tempfile.NamedTemporaryFile(prefix="screen_capture_")
        filename = f"{os.path.basename(filename.name)}.png"
        filename = os.path.join(context.options.screenshots_dir, filename)
        context.driver.save_screenshot(filename)
        html = f'<a href="{filename}" target="_blank">Screen Shot</a>'
        html = base64.b64encode(html.encode("utf-8")).decode("utf-8")

        uitests.report.PrettyCucumberJSONFormatter.instance.attach_html(html)


def capture_screen_to_file(context):
    filename = tempfile.NamedTemporaryFile(prefix="screen_capture_")
    filename = f"{os.path.basename(filename.name)}.png"
    filename = os.path.join(context.options.screenshots_dir, filename)
    context.driver.save_screenshot(filename)
    return filename


def capture_exception(context, info=None):
    if info is None or info.exc_traceback is None or info.exception is None:
        return

    formatted_ex = traceback.format_exception(
        type(info.exception), info.exception, info.exc_traceback
    )
    html = f"<h>Error</h><p>{formatted_ex}</p>"
    html = base64.b64encode(html.encode("utf-8")).decode("utf-8")

    uitests.report.PrettyCucumberJSONFormatter.instance.attach_html(html)


def _get_binary_location(executable_directory, channel):
    if sys.platform.startswith("darwin"):
        return os.path.join(
            executable_directory,
            "Visual Studio Code.app"
            if channel == "stable"
            else "Visual Studio Code - Insiders.app",
            "Contents",
            "MacOS",
            "Electron",
        )

    if sys.platform.startswith("win"):
        return os.path.join(
            executable_directory,
            "Code.exe" if channel == "stable" else "Code - Insiders.exe",
        )

    return os.path.join(
        executable_directory,
        "VSCode-linux-x64",
        "code" if channel == "stable" else "code-insiders",
    )


def _get_cli_location(executable_directory):
    if sys.platform.startswith("darwin"):
        return os.path.join(
            executable_directory,
            "Visual Studio Code.app",
            "Contents",
            "Resources",
            "app",
            "out",
            "cli.js",
        )

    if sys.platform.startswith("win"):
        return os.path.join(executable_directory, "resources", "app", "out", "cli.js")

    return os.path.join(
        executable_directory, "VSCode-linux-x64", "resources", "app", "out", "cli.js"
    )
