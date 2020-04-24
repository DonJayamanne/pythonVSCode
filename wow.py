import json
import logging
import os
import signal
import sys
import subprocess
import threading

# from vscode_datascience_helpers.kernel_launcher import launch_kernel
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
        print("Check Kaboom2")
        while self.kernel.poll() is None:
            self.kernel_started.set()
            stderr_output = self.kernel.stderr.read()
            if stderr_output:
                # self.log.debug(
                #     "subprocess output for, %s with args %s, has stderr_output %s",
                #     module_name,
                #     stderr_output.decode("utf-8"),
                #     stderr_output,
                # )
                print('stderr_output')
                print(stderr_output)
                # sys.stderr.write(stderr_output)
                #sys.stderr.flush()
        print("Kaboom2")

    def _read_stdout_in_background(self):
        print("Check Kaboom")
        while self.kernel.poll() is None:
            print('stdout_output')
            stdout_output = self.kernel.stdout.read()
            print(stdout_output)
            if stdout_output:
                print(stdout_output)
                # self.log.debug(
                #     "subprocess output for, %s with args %s, has stdout_output %s",
                #     module_name,
                #     stdout_output.decode("utf-8"),
                #     stdout_output,
                # )
                # sys.stdout.write(stdout_output)
        print("Kaboom")
    def _monitor_kernel(self):
        print("Checking %s", self.kernel.pid)
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
            print(env)
            # with open('env.json', 'w') as fp:
            #     json.dump(env, fp)
            # env['PYTHONUNBUFFERED'] = '1'
            # #env = {'SHELL': '/bin/zsh', 'SSH_AUTH_SOCK': '/private/tmp/com.apple.launchd.VGYkUZ66qF/Listeners', 'XPC_FLAGS': '0x0', 'XPC_SERVICE_NAME': '0', 'HOME': '/Users/donjayamanne', 'LOGNAME': 'donjayamanne', 'TMPDIR': '/var/folders/56/9h11nzxj6b78yvk72vsngk140000gn/T/', 'PATH': '/Users/donjayamanne/Desktop/Development/crap/docBug/venvForWidgets/bin:/Users/donjayamanne/.yarn/bin:/Users/donjayamanne/.config/yarn/global/node_modules/.bin:/Users/donjayamanne/.poetry/bin:/Users/donjayamanne/.poetry/bin:/Users/donjayamanne/.nvm/versions/node/v12.4.0/bin:/Users/donjayamanne/.local/share/virtualenvs:/Users/donjayamanne/.pyenv/shims:/Users/donjayamanne/Desktop/Development/software/anaconda/anaconda3/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/go/bin', 'TERM_PROGRAM': 'vscode', 'TERM_PROGRAM_VERSION': '1.45.0-insider', 'LANG': 'en_US.UTF-8', 'COLORTERM': 'truecolor', 'PWD': '/', 'TERM': 'xterm-256color', 'SHLVL': '1', 'OLDPWD': '/Users/donjayamanne/Desktop/Development/crap/docBug', 'ZSH': '/Users/donjayamanne/.oh-my-zsh', 'PAGER': 'less', 'LESS': '-R', 'LSCOLORS': 'Gxfxcxdxbxegedabagacad', 'CONDA_EXE': '/opt/miniconda3/bin/conda', '_CE_M': '', '_CE_CONDA': '', 'CONDA_PYTHON_EXE': '/opt/miniconda3/bin/python', 'CONDA_SHLVL': '0', 'LDFLAGS': '-L/usr/local/opt/readline/lib', 'CPPFLAGS': '-I/usr/local/opt/readline/include', 'PYENV_SHELL': 'zsh', 'NVM_DIR': '/Users/donjayamanne/.nvm', 'NVM_CD_FLAGS': '-q', 'NVM_BIN': '/Users/donjayamanne/.nvm/versions/node/v12.4.0/bin', 'VIRTUAL_ENV': '/Users/donjayamanne/Desktop/Development/crap/docBug/venvForWidgets', 'PS1': '(venvForWidgets) ', '_': '/Users/donjayamanne/Desktop/Development/crap/docBug/venvForWidgets/bin/python', '__CF_USER_TEXT_ENCODING': '0x1F5:0x0:0x0', 'KERNEL_LAUNCH_TIMEOUT': '40', 'BEAKERX_AUTOTRANSLATION_PASSWORD': 'iJ1Z5bPKcXRzPLZ27VOPweV0wlqalmJQIo1H3ByfYA3yXY7pyFd15ozum8Ld6FLtAuKEnqushYpqm3Uab0xMEGOsOIgNAYq1GRbsKttocZqbFoFDm5BpU0etEAdehFt5', 'BEAKERX_AUTOTRANSLATION_PORT': '63658', 'VSCODE_NODE_CACHED_DATA_DIR': '/Users/donjayamanne/Library/Application Support/Code/CachedData/a9f8623ec050e5f0b44cc8ce8204a1455884749f', 'AMD_ENTRYPOINT': 'vs/workbench/services/extensions/node/extensionHostProcess', 'PYTHONUNBUFFERED': '1', 'PYTHONIOENCODING': 'utf-8', 'USER': 'donjayamanne', 'COMMAND_MODE': 'unix2003', 'VSCODE_LOG_STACK': 'false', 'WOW': 'UPDATED', 'ELECTRON_RUN_AS_NODE': '1', 'VSCODE_LOGS': '/Users/donjayamanne/Library/Application Support/Code/logs/20200416T213050', 'LaunchInstanceID': '09EE0261-0BFC-44E3-BFAE-215BFEA1D9F4', 'VSCODE_HANDLES_UNCAUGHT_ERRORS': 'true', 'APPLICATION_INSIGHTS_NO_DIAGNOSTIC_CHANNEL': 'true', 'PIPE_LOGGING': 'true', 'VSCODE_IPC_HOOK_EXTHOST': '/var/folders/56/9h11nzxj6b78yvk72vsngk140000gn/T/vscode-ipc-53fdde40-274c-470b-a29a-b21d13e0cbea.sock', 'VSCODE_NLS_CONFIG': '{"locale":"en-us","availableLanguages":{},"_languagePackSupport":true}', 'PYTHONPATH': './one', 'THAT': 'ABC', 'VSCODE_IPC_HOOK': '/Users/donjayamanne/Library/Application Support/Code/1.44.1-main.sock', 'VSCODE_PID': '476', 'VERBOSE_LOGGING': 'true', 'SECURITYSESSIONID': '186a7', 'LC_CTYPE': 'UTF-8'}
            # print(cmd)
            # proc = launch_kernel(
            proc = subprocess.Popen(
                # cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd, env=env, independent=True
                cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd, env=env
                # cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,env=env
                # cmd, stdout=sys.stdout, stderr=sys.stderr,env=env
            )
        except:
            import traceback
            self.kernel_start_error = traceback.format_exc()
            print("Failed starting kernel. Error: %s", self.kernel_start_error)
            sys.stderr.write(self.kernel_start_error)
            self.kernel_started.set()
            return
        import time
        time.sleep(5)
        print(proc.stderr.read())
        self.kernel = proc
        print("Kernel launched, with PID %s", proc.pid)

        # threading.Thread(
        #     target=self._read_stdout_in_background,
        #     daemon=True,
        # ).start()
        # threading.Thread(
        #     target=self._read_stderr_in_background,
        #     daemon=True,
        # ).start()
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
d.exec_module_observable_in_background('ipykernel_launcher', ['-f', '/Users/donjayamanne/Desktop/Development/vsc/pythonVSCode/wow.json'])
time.sleep(10)
print('end')
