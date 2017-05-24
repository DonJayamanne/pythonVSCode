import os
import sys
import socket
import traceback
import logging
import traceback
import struct
import sys
import time
import os

from pydev_py_comm import VSCodeWriter, VSCodeReader, PydevWriter
from debugger_unittest import DebuggerRunner
from copy import copy

logging_filename = os.path.join(
    os.path.dirname(__file__), 'pydev_debugger.log')
logging.basicConfig(filename=logging_filename, level=logging.DEBUG)


class Debugger(DebuggerRunner):
    def __init__(self,
                 file,
                 port_num,
                 debug_id,
                 debug_options,
                 current_pid,
                 run_as='script'):
        self.file = file
        self.port_num = port_num
        self.debug_id = debug_id
        self.debug_options = debug_options
        self.current_pid = current_pid
        self.run_as = run_as

    def get_command_line(self):
        return [sys.executable, '-u']

    def add_command_line_args(self, args):
        return args + [self.file]

    @classmethod
    def from_arguments(cls, sys_argv):
        sys_argv = copy(sys_argv)
        os.chdir(sys_argv[1])

        port_num = int(sys_argv[2])
        debug_id = sys_argv[3]
        debug_options = cls.parse_debug_options(sys_argv[4])
        del sys_argv[0:5]

        # set run_as mode appropriately
        run_as = 'script'
        if sys_argv and sys_argv[0] == '-m':
            run_as = 'module'
            del sys_argv[0]
        if sys_argv and sys_argv[0] == '-c':
            run_as = 'code'
            del sys_argv[0]

        return cls(
            file=sys_argv[0],
            port_num=port_num,
            debug_id=debug_id,
            debug_options=debug_options,
            current_pid=os.getpid(),
            run_as=run_as)

    @staticmethod
    def parse_debug_options(s):
        return set([opt.strip() for opt in s.split(',')])

    def run_process(self, args, writer_thread):
        process = self.create_process(args, writer_thread)

    ## Modified parameters by Don Jayamanne
    # Accept current Process id to pass back to debugger
    def debug(self):
        logging.debug('begin process attach')
        for i in range(50):
            try:
                self.conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.conn.connect(('127.0.0.1', self.port_num))

                self.reader = VSCodeReader(self.conn)
                self.writer = VSCodeWriter(self.conn)

                self.writer.write_string(self.debug_id)
                self.writer.write_int(0)  # success
                ## Begin modification by Don Jayamanne
                # Pass current Process id to pass back to debugger
                self.writer.write_int(self.current_pid)  # success
                ## End Modification by Don Jayamanne            
                logging.debug('attached')
                break
            except:
                logging.exception('failed to attach')
                time.sleep(50. / 1000)
        else:
            raise Exception('failed to attach')

        try:
            writer = PydevWriter(self.writer, self.reader)
            writer.start()
            for _i in range(40000):
                if hasattr(writer, 'port'):
                    break
                time.sleep(.01)

            self.run_process(
                self.add_command_line_args(self.get_command_line()), writer)
        finally:
            writer.do_kill()
            writer.log = []


if __name__ == '__main__':
    logging.debug('debugger initialized')
    # Arguments are:
    # 1. Working directory.
    # 2. VS debugger port to connect to.
    # 3. GUID for the debug session.
    # 4. Debug options (as integer - see enum PythonDebugOptions).
    # 5. '-m' or '-c' to override the default run-as mode. [optional]
    # 6. Startup script name.
    # 7. Script arguments.

    # change to directory we expected to start from
    try:
        # Pass current Process id to pass back to debugger
        Debugger.from_arguments(sys.argv).debug()
    except Exception as e:
        logging.exception('unexpected failure')
        raise e