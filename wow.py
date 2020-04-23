import json
import logging
import os
import signal
import sys
import subprocess
import threading

from vscode_datascience_helpers.kernel_launcher import launch_kernel
log = logging.getLogger(__name__)
root_logger = logging.root
LOG_FORMAT = (
    "%(asctime)s UTC - %(levelname)s - (PID: %(process)d) - %(name)s - %(message)s"
)
root_logger.setLevel(logging.DEBUG)


class PythonDaemon:
    def __init__(self):
        self.killing_kernel = False
        self.kernel_started = threading.Event()
        self.kernel_start_error = ""
        self.log = logging.getLogger(
            "{0}.{1}".format(self.__class__.__module__, self.__class__.__name__)
        )
        print("DataScience Kernel Launcher Daemon init")

    def m_exec_module_observable(self, module_name, args=None, cwd=None, env=None):
        thread_args = (module_name, args, cwd, None)
        self.kernel_thread = threading.Thread(
            target=self.exec_module_observable_in_background,
            args=thread_args,
            daemon=True,
        )
        self.kernel_thread.start()

    def _read_stderr_in_background(self):
        while self.kernel.poll() is None:
            self.kernel_started.set()
            stderr_output = self.kernel.stderr.read(1)
            if stderr_output:
                # self.log.debug(
                #     "subprocess output for, %s with args %s, has stderr_output %s",
                #     module_name,
                #     stderr_output.decode("utf-8"),
                #     stderr_output,
                # )
                sys.stderr.buffer.write(stderr_output)
                #sys.stderr.flush()

    def _read_stdout_in_background(self):
        while self.kernel.poll() is None:
            stdout_output = self.kernel.stdout.read(1)
            if stdout_output:
                # self.log.debug(
                #     "subprocess output for, %s with args %s, has stdout_output %s",
                #     module_name,
                #     stdout_output.decode("utf-8"),
                #     stdout_output,
                # )
                sys.stdout.buffer.write(stdout_output)

    def _monitor_kernel(self):
        while self.kernel.poll() is None:
            pass
        print("Bye kernel output %s", self.kernel.pid)
        exit_code = self.kernel.poll()
        self.log.warn(
            "Kernel exited with exit code %s",
            exit_code,
        )
        sys.stdout.flush()
        sys.stderr.flush()

        if not self.killing_kernel:
            # Somethign is wrong, lets kill this daemon.
            sys.exit(exit_code)

    def exec_module_observable_in_background(
        self, module_name, args=None, cwd=None, env=None
    ):
        print(
            "Exec in DS Kernel Launcher Daemon (observable) %s with args %s",
            module_name,
            args,
        )
        try:
            args = [] if args is None else args
            cmd = [sys.executable, "-m", module_name] + args
            env = os.environ.copy()
            proc = launch_kernel(
            # proc = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd, env=env, independent=True
            )
        except:
            self.kernel_start_error = traceback.format_exc()
            print("Failed starting kernel. Error: %s", self.kernel_start_error)
            sys.stderr.write(self.kernel_start_error)
            self.kernel_started.set()
            return

        self.kernel = proc
        print("Kernel launched, with PID %s", proc.pid)

        threading.Thread(
            target=self._read_stdout_in_background,
            daemon=True,
        ).start()
        threading.Thread(
            target=self._read_stderr_in_background,
            daemon=True,
        ).start()
        threading.Thread(
            target=self._monitor_kernel,
            daemon=True,
        ).start()

        print("Kernel started output %d", proc.pid)
        self.kernel_started.set()

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



import time
print('start')
d = PythonDaemon()
d.exec_module_observable_in_background('ipykernel_launcher', ['-f', '/var/folders/56/9h11nzxj6b78yvk72vsngk140000gn/T/tmp-92647W1h56TYJUxOa.json'])
time.sleep(10)
print('end')
