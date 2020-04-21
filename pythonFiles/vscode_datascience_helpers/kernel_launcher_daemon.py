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
    def m_exec_module_observable(self, module_name, args=None, cwd=None, env=None):
        thread_args = (module_name, args, cwd, env)
        self.kernel_thread = threading.Thread(
            target=self.exec_module_observable_in_background,
            args=thread_args,
            daemon=True,
        )
        self.kernel_thread.start()

    def exec_module_observable_in_background(
        self, module_name, args=None, cwd=None, env=None
    ):
        self.log.info(
            "Exec in DS Kernel Launcher Daemon (observable) %s with args %s",
            module_name,
            args,
        )
        args = [] if args is None else args
        cmd = [sys.executable, "-m", module_name] + args
        proc = launch_kernel(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd, env=env
        )
        self.kernel = proc
        self.log.info("Kernel launched, with PID %s", proc.pid)

        while proc.poll() is None:
            stdout_output = proc.stdout.read(1)
            if stdout_output:
                self.log.debug(
                    "subprocess output for, %s with args %s, has stdout_output %s",
                    module_name,
                    stdout_output.decode("utf-8"),
                    stdout_output,
                )
                sys.stdout.buffer.write(stdout_output)
            stderr_output = proc.stdout.read(1)
            if stderr_output:
                self.log.debug(
                    "subprocess output for, %s with args %s, has stderr_output %s",
                    module_name,
                    stderr_output.decode("utf-8"),
                    stderr_output,
                )
                sys.stderr.buffer.write(stderr_output)

        exit_code = proc.poll()
        self.log.warn(
            "subprocess output for, %s with args %s, has exited with exit code %s",
            module_name,
            args,
            exit_code,
        )
        sys.stdout.flush()
        sys.stderr.flush()

        if not self.killing_kernel:
            # Somethign is wrong, lets kill this daemon.
            sys.exit(exit_code)

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
