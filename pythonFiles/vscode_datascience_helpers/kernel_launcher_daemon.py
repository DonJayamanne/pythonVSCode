# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import json
import logging
import os
import signal
import sys
import subprocess
import threading
from vscode_datascience_helpers.daemon.daemon_python import (
    error_decorator,
    PythonDaemon as BasePythonDaemon,
    change_exec_context,
)
from vscode_datascience_helpers.jupyter_daemon import PythonDaemon as JupyterDaemon
from vscode_datascience_helpers.kernel_launcher import launch_kernel


class PythonDaemon(JupyterDaemon):
    def __init__(self, rx, tx):
        super().__init__(rx, tx)
        self.killing_kernel = False
        self.log.info("DataScience Kernel Launcher Daemon init")

    def close(self):
        """Ensure we kill the kernel when shutting down the daemon.
        """
        try:
            self.m_kill_kernel()
        except:
            pass
        super().close()

    @error_decorator
    def m_interrupt_kernel(self):
        """Interrupts the kernel by sending it a signal.
        Unlike ``signal_kernel``, this operation is well supported on all
        platforms.
        Borrowed from https://github.com/jupyter/jupyter_client/blob/master/jupyter_client/manager.py
        """
        self.log.info("Interrupt kernel in DS Kernel Launcher Daemon")
        if self.kernel is not None:
            if sys.platform == "win32":
                self.log.debug("Interrupt kernel on Windows")
                from vscode_datascience_helpers.win_interrupt import send_interrupt

                send_interrupt(self.kernel.win32_interrupt_event)
            else:
                self.log.debug("Interrupt kernel with SIGINT")
                self.signal_kernel(signal.SIGINT)

    @error_decorator
    def m_kill_kernel(self):
        """Interrupts the kernel by sending it a signal.
        Unlike ``signal_kernel``, this operation is well supported on all
        platforms.
        Borrowed from https://github.com/jupyter/jupyter_client/blob/master/jupyter_client/manager.py
        """
        self.log.info("Kill kernel in DS Kernel Launcher Daemon")
        self.killing_kernel = True
        if self.kernel is not None:
            # Signal the kernel to terminate (sends SIGKILL on Unix and calls
            # TerminateProcess() on Win32).
            try:
                if hasattr(signal, "SIGKILL"):
                    self.signal_kernel(signal.SIGKILL)
                else:
                    self.kernel.kill()
            except OSError:
                pass
            finally:
                self.kernel = None

    @error_decorator
    def m_exec_module(self, module_name, args=[], cwd=None, env=None):
        """Override default behavior to run the ipykernel module in a background thread."""
        args = [] if args is None else args
        self.log.info(
            "Exec module in DS Kernel Launcher Daemon %s with args %s",
            module_name,
            args,
        )

        def start_kernel():
            thread_args = (module_name, args, cwd, env)
            self._exec_module_observable_in_background(module_name, args, cwd, env)

        return self._execute_and_capture_output(start_kernel)

    def _read_stderr_in_background(self):
        while self.kernel.poll() is None:
            stderr_output = self.kernel.stderr.readline()
            if stderr_output:
                sys.stderr.write(stderr_output)
                sys.stderr.flush()

    def _read_stdout_in_background(self):
        while self.kernel.poll() is None:
            stdout_output = self.kernel.stdout.readline()
            if stdout_output:
                sys.stdout.write(stdout_output)
                sys.stdout.flush()

    def _monitor_kernel(self):
        while self.kernel.poll() is None:
            pass

        exit_code = self.kernel.poll()
        std_err = self.kernel.stderr.read()
        if std_err:
            std_err = std_err.decode()
        self.log.warn("Kernel has exited with exit code %s, %s", exit_code, std_err)
        sys.stdout.flush()
        sys.stderr.flush()
        self._endpoint.notify(
            "kernel_died", {"exit_code": exit_code, "reason": std_err}
        )

    def _exec_module_observable_in_background(
        self, module_name, args=None, cwd=None, env=None
    ):
        self.log.info(
            "Exec in DS Kernel Launcher Daemon (observable) %s with args %s",
            module_name,
            args,
        )
        args = [] if args is None else args
        cmd = [sys.executable, "-m", module_name] + args
        # For some reason kernel does not start on mac with `independent=False`
        # As we are incontrol of the kernel, we can safely set this.
        env = {'SHELL': '/bin/zsh', 'SSH_AUTH_SOCK': '/private/tmp/com.apple.launchd.VGYkUZ66qF/Listeners', 'XPC_FLAGS': '0x0', 'XPC_SERVICE_NAME': '0', 'HOME': '/Users/donjayamanne', 'LOGNAME': 'donjayamanne', 'TMPDIR': '/var/folders/56/9h11nzxj6b78yvk72vsngk140000gn/T/', 'PATH': '/Users/donjayamanne/Desktop/Development/crap/docBug/venvForWidgets/bin:/Users/donjayamanne/.yarn/bin:/Users/donjayamanne/.config/yarn/global/node_modules/.bin:/Users/donjayamanne/.poetry/bin:/Users/donjayamanne/.poetry/bin:/Users/donjayamanne/.nvm/versions/node/v12.4.0/bin:/Users/donjayamanne/.local/share/virtualenvs:/Users/donjayamanne/.pyenv/shims:/Users/donjayamanne/Desktop/Development/software/anaconda/anaconda3/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/go/bin', 'TERM_PROGRAM': 'vscode', 'TERM_PROGRAM_VERSION': '1.45.0-insider', 'LANG': 'en_US.UTF-8', 'COLORTERM': 'truecolor', 'PWD': '/', 'TERM': 'xterm-256color', 'SHLVL': '1', 'OLDPWD': '/Users/donjayamanne/Desktop/Development/crap/docBug', 'ZSH': '/Users/donjayamanne/.oh-my-zsh', 'PAGER': 'less', 'LESS': '-R', 'LSCOLORS': 'Gxfxcxdxbxegedabagacad', 'CONDA_EXE': '/opt/miniconda3/bin/conda', '_CE_M': '', '_CE_CONDA': '', 'CONDA_PYTHON_EXE': '/opt/miniconda3/bin/python', 'CONDA_SHLVL': '0', 'LDFLAGS': '-L/usr/local/opt/readline/lib', 'CPPFLAGS': '-I/usr/local/opt/readline/include', 'PYENV_SHELL': 'zsh', 'NVM_DIR': '/Users/donjayamanne/.nvm', 'NVM_CD_FLAGS': '-q', 'NVM_BIN': '/Users/donjayamanne/.nvm/versions/node/v12.4.0/bin', 'VIRTUAL_ENV': '/Users/donjayamanne/Desktop/Development/crap/docBug/venvForWidgets', 'PS1': '(venvForWidgets) ', '_': '/Users/donjayamanne/Desktop/Development/crap/docBug/venvForWidgets/bin/python', '__CF_USER_TEXT_ENCODING': '0x1F5:0x0:0x0', 'KERNEL_LAUNCH_TIMEOUT': '40', 'BEAKERX_AUTOTRANSLATION_PASSWORD': 'iJ1Z5bPKcXRzPLZ27VOPweV0wlqalmJQIo1H3ByfYA3yXY7pyFd15ozum8Ld6FLtAuKEnqushYpqm3Uab0xMEGOsOIgNAYq1GRbsKttocZqbFoFDm5BpU0etEAdehFt5', 'BEAKERX_AUTOTRANSLATION_PORT': '63658', 'VSCODE_NODE_CACHED_DATA_DIR': '/Users/donjayamanne/Library/Application Support/Code/CachedData/a9f8623ec050e5f0b44cc8ce8204a1455884749f', 'AMD_ENTRYPOINT': 'vs/workbench/services/extensions/node/extensionHostProcess', 'PYTHONUNBUFFERED': '1', 'PYTHONIOENCODING': 'utf-8', 'USER': 'donjayamanne', 'COMMAND_MODE': 'unix2003', 'VSCODE_LOG_STACK': 'false', 'WOW': 'UPDATED', 'ELECTRON_RUN_AS_NODE': '1', 'VSCODE_LOGS': '/Users/donjayamanne/Library/Application Support/Code/logs/20200416T213050', 'LaunchInstanceID': '09EE0261-0BFC-44E3-BFAE-215BFEA1D9F4', 'VSCODE_HANDLES_UNCAUGHT_ERRORS': 'true', 'APPLICATION_INSIGHTS_NO_DIAGNOSTIC_CHANNEL': 'true', 'PIPE_LOGGING': 'true', 'VSCODE_IPC_HOOK_EXTHOST': '/var/folders/56/9h11nzxj6b78yvk72vsngk140000gn/T/vscode-ipc-53fdde40-274c-470b-a29a-b21d13e0cbea.sock', 'VSCODE_NLS_CONFIG': '{"locale":"en-us","availableLanguages":{},"_languagePackSupport":true}', 'PYTHONPATH': './one', 'THAT': 'ABC', 'VSCODE_IPC_HOOK': '/Users/donjayamanne/Library/Application Support/Code/1.44.1-main.sock', 'VSCODE_PID': '476', 'VERBOSE_LOGGING': 'true', 'SECURITYSESSIONID': '186a7', 'LC_CTYPE': 'UTF-8'}
        proc = launch_kernel(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=cwd,
            env=env,
            independent=False,
        )
        self.log.info(
            "Exec in DS Kernel Launcher Daemon (observable) %s with args %s",
            subprocess.PIPE,
            subprocess.PIPE,
        )

        self.kernel = proc
        self.log.info("Kernel launched, with PID %s", proc.pid)

        threading.Thread(target=self._read_stdout_in_background, daemon=True, name="kerne_stdout_reader").start()
        threading.Thread(target=self._read_stderr_in_background, daemon=True, name="kerne_stderr_reader").start()
        threading.Thread(target=self._monitor_kernel, daemon=True, name="kerne_monitor").start()

    def signal_kernel(self, signum):
        """Sends a signal to the process group of the kernel (this
        usually includes the kernel and any subprocesses spawned by
        the kernel).
        Note that since only SIGTERM is supported on Windows, this function is
        only useful on Unix systems.
        """
        if self.kernel is not None:
            if hasattr(os, "getpgid") and hasattr(os, "killpg"):
                try:
                    pgid = os.getpgid(self.kernel.pid)
                    os.killpg(pgid, signum)
                    self.log.debug(
                        "Signalled kernel PID %s, with %s", self.kernel.pid, signum
                    )
                    return
                except OSError:
                    self.log.debug(
                        "Failed to signal kernel PID %s, with %s",
                        self.kernel.pid,
                        signum,
                    )
                    pass
            self.log.debug(
                "Signalling kernel with using send_signal PID %s, with %s",
                self.kernel.pid,
                signum,
            )
            self.kernel.send_signal(signum)
