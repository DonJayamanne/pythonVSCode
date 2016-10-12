
import sys
import socket
import select
import time
import re
import json
import struct
import imp
import traceback
import random
import os
import io
import inspect
import types
from collections import deque

try:
    import thread
except ImportError:
    # Renamed in Python3k
    import _thread as thread

import visualstudio_py_util as _vspu

to_bytes = _vspu.to_bytes
read_bytes = _vspu.read_bytes
read_int = _vspu.read_int
read_string = _vspu.read_string
write_bytes = _vspu.write_bytes
write_int = _vspu.write_int
write_string = _vspu.write_string

try:
    unicode
except NameError:
    unicode = str

try:
    BaseException
except NameError:
    # BaseException not defined until Python 2.5
    BaseException = Exception

DEBUG = os.environ.get('DEBUG_DJAYAMANNE_IPYTHON') is not None

def _debug_write(out):
    if DEBUG:
        sys.__stdout__.write(out)
        sys.__stdout__.flush()

class IPythonExitException(Exception): pass

class SafeSendLock(object):
    """a lock which ensures we're released if we take a KeyboardInterrupt exception acquiring it"""
    def __init__(self):
        self.lock = thread.allocate_lock()

    def __enter__(self):
        self.acquire()

    def __exit__(self, exc_type, exc_value, tb):
        self.release()

    def acquire(self):
        try:
            self.lock.acquire()
        except KeyboardInterrupt:
            try:
                self.lock.release()
            except:
                pass
            raise

    def release(self):
        self.lock.release()

class iPythonSocketServer(object):
    """back end for executing REPL code.  This base class handles all of the
communication with the remote process while derived classes implement the
actual inspection and introspection."""
    _MRES = to_bytes('MRES')
    _SRES = to_bytes('SRES')
    _MODS = to_bytes('MODS')
    _IMGD = to_bytes('IMGD')
    _PRPC = to_bytes('PRPC')
    _RDLN = to_bytes('RDLN')
    _STDO = to_bytes('STDO')
    _STDE = to_bytes('STDE')
    _DBGA = to_bytes('DBGA')
    _DETC = to_bytes('DETC')
    _DPNG = to_bytes('DPNG')
    _DXAM = to_bytes('DXAM')

    _MERR = to_bytes('MERR')
    _SERR = to_bytes('SERR')
    _ERRE = to_bytes('ERRE')
    _EXIT = to_bytes('EXIT')
    _DONE = to_bytes('DONE')
    _MODC = to_bytes('MODC')

    """Messages sent back as responses"""
    _PONG = to_bytes('PONG')

    def __init__(self):
        import threading
        self.conn = None
        self.send_lock = SafeSendLock()
        self.input_event = threading.Lock()
        self.input_event.acquire()  # lock starts acquired (we use it like a manual reset event)
        self.input_string = None
        self.exit_requested = False
        self.execute_item = None
        self.execute_item_lock = threading.Lock()
        self.execute_item_lock.acquire()    # lock starts acquired (we use it like manual reset event)
        self.exit_socket_loop = False

    def connect(self, port):
        self.conn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.conn.connect(('127.0.0.1', port))

        # perform the handshake
        with self.send_lock:
            write_string(self.conn, "Some Guid")
            write_int(self.conn, os.getpid())

        # start a new thread for communicating w/ the remote process
        thread.start_new_thread(self.start_processing, ())

    def start_processing(self):
        """loop on created thread which processes communicates with the REPL window"""
        print('start processing')
        try:
            while True:
                print('one')
                if self.check_for_exit_socket_loop():
                    break

                # we receive a series of 4 byte commands.  Each command then
                # has it's own format which we must parse before continuing to
                # the next command.
                self.flush()
                self.conn.settimeout(10)
                print('check bytes')
                inp = read_bytes(self.conn, 4)
                self.conn.settimeout(None)
                if inp == '':
                    print ('unknown command', inp)
                    break

                self.flush()
                cmd = iPythonSocketServer._COMMANDS.get(inp)
                if cmd is not None:
                    cmd(self)
        except IPythonExitException:
            pass
        except socket.error:
            pass
        except:
            print('crap')
            _debug_write('error in repl loop')
            _debug_write(traceback.format_exc())

            time.sleep(2) # try and exit gracefully, then interrupt main if necessary
            traceback.print_exc()
            self.exit_process()

    def check_for_exit_socket_loop(self):
        return self.exit_socket_loop

    def _cmd_run(self):
        """runs the received snippet of code"""
        # self.run_command(read_string(self.conn))
        pass

    def _cmd_abrt(self):
        """aborts the current running command"""
        # abort command, interrupts execution of the main thread.
        pass

    def _cmd_exit(self):
        """exits the interactive process"""
        self.exit_requested = True
        self.exit_process()

    def _cmd_ping(self):
        """ping"""
        message = read_string(self.conn)
        with self.send_lock:
            write_bytes(self.conn, iPythonSocketServer._PONG)
            write_string(self.conn, "pong received with message" + message)

    def _cmd_inpl(self):
        """handles the input command which returns a string of input"""
        self.input_string = read_string(self.conn)
        self.input_event.release()

    def send_prompt(self, ps1, ps2, update_all = True):
        """sends the current prompt to the interactive window"""
        # with self.send_lock:
        #     write_bytes(self.conn, iPythonSocketServer._PRPC)
        #     write_string(self.conn, ps1)
        #     write_string(self.conn, ps2)
        #     write_int(self.conn, update_all)
        pass

    def send_error(self):
        """reports that an error occured to the interactive window"""
        with self.send_lock:
            write_bytes(self.conn, iPythonSocketServer._ERRE)

    def send_exit(self):
        """reports the that the REPL process has exited to the interactive window"""
        with self.send_lock:
            write_bytes(self.conn, iPythonSocketServer._EXIT)

    def send_command_executed(self):
        with self.send_lock:
            write_bytes(self.conn, iPythonSocketServer._DONE)

    def read_line(self):
        """reads a line of input from standard input"""
        with self.send_lock:
            write_bytes(self.conn, iPythonSocketServer._RDLN)
        self.input_event.acquire()
        return self.input_string

    def write_stdout(self, value):
        """writes a string to standard output in the remote console"""
        with self.send_lock:
            write_bytes(self.conn, iPythonSocketServer._STDO)
            write_string(self.conn, value)

    def write_stderr(self, value):
        """writes a string to standard input in the remote console"""
        with self.send_lock:
            write_bytes(self.conn, iPythonSocketServer._STDE)
            write_string(self.conn, value)

    ################################################################
    # Implementation of execution, etc...

    def execution_loop(self):
        """loop on the main thread which is responsible for executing code"""
        while True:
            exit = self.run_one_command(cur_modules, cur_ps1, cur_ps2)
            if exit:
                return

    def run_command(self, command):
        """runs the specified command which is a string containing code"""
        pass

    def interrupt_main(self):
        """aborts the current running command"""
        pass

    def exit_process(self):
        """exits the REPL process"""
        pass

    def flush(self):
        """flushes the stdout/stderr buffers"""
        pass

    _COMMANDS = {
        to_bytes('run '): _cmd_run,
        to_bytes('abrt'): _cmd_abrt,
        to_bytes('exit'): _cmd_exit,
        to_bytes('ping'): _cmd_ping,
        to_bytes('inpl'): _cmd_inpl,
    }

def exit_work_item():
    sys.exit(0)

class iPythonReadLine(object):
    def __init__(self):
        self._input = io.open(sys.stdin.fileno(), encoding='utf-8')

    def _deserialize(self, request):
        """Deserialize request from VSCode.

        Args:
            request: String with raw request from VSCode.

        Returns:
            Python dictionary with request data.
        """
        return json.loads(request)

    def _set_request_config(self, config):
        self.use_snippets = config.get('useSnippets')
        self.show_doc_strings = config.get('showDescriptions', True)
        self.fuzzy_matcher = config.get('fuzzyMatcher', False)

    def _process_request(self, request):
        """Accept serialized request from VSCode and write response.
        """
        request = self._deserialize(request)

        self._set_request_config(request.get('config', {}))

        lookup = request.get('lookup', 'completions')

        if lookup == 'definitions':
            return self._write_response('defs')
        elif lookup == 'arguments':
            return self._write_response('arguments')
        elif lookup == 'usages':
            return self._write_response('usages')
        else:
            return self._write_response('Dont Know')

    def _write_response(self, response):
        sys.stdout.write(response + '\n')
        sys.stdout.flush()

    def watch(self):
        server = iPythonSocketServer()
        server.connect(3000)
        while True:
            try:
                self._process_request(self._input.readline())
            except Exception:
                sys.stderr.write(traceback.format_exc() + '\n')
                sys.stderr.flush()

if __name__ == '__main__':
    iPythonReadLine().watch()
