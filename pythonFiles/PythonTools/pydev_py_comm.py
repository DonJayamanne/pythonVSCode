import logging
import sys
import struct
import socket

from encodings import utf_8, ascii
from debugger_unittest import AbstractWriterThread, ReaderThread

if sys.version_info[0] >= 3:

    def to_bytes(cmd_str):
        return ascii.Codec.encode(cmd_str)[0]

    unicode = str
else:

    def to_bytes(cmd_str):
        return cmd_str


UNICODE_PREFIX = to_bytes('U')
ASCII_PREFIX = to_bytes('A')
NONE_PREFIX = to_bytes('N')


class VSCodeWriter(object):
    "writes information to vscode"

    def __init__(self, sock):
        self.sock = sock

    def write_bytes(self, b, log=True):

        if log:
            logging.debug('write_bytes: {}'.format(b))
        self.sock.sendall(b)

    def write_int(self, i, log=True):

        self.write_bytes(struct.pack('!q', i), log=False)

        if log:
            logging.debug('write_int: {}'.format(i))

    def write_string(self, s, log=True):
        if s is None:
            self.write_bytes(NONE_PREFIX, log=False)
        elif isinstance(s, unicode):
            b = utf_8.encode(s)[0]
            b_len = len(b)
            self.write_bytes(UNICODE_PREFIX, log=False)
            self.write_int(b_len, log=False)
            if b_len > 0:
                self.write_bytes(b, log=False)
        else:
            s_len = len(s)
            self.write_bytes(ASCII_PREFIX, log=False)
            self.write_int(s_len, log=False)
            if s_len > 0:
                self.write_bytes(s, log=False)

        if log:
            logging.debug('write_string: {}'.format(s))


class VSCodeReader(object):
    """"reads commands from vscode"""

    def __init__(self, sock):
        self.sock = sock

    def read_bytes(self, count, log=True):

        b = to_bytes('')
        while len(b) < count:
            b += self.sock.recv(count - len(b))

        if log:
            logging.debug('read_bytes: {}'.format(b))
        return b

    def read_int(self, log=True):

        i = struct.unpack('!q', self.read_bytes(8, log=False))[0]

        if log:
            logging.debug('read_int: {}'.format(i))

        return i

    def read_string(self, log=True):
        """ reads length of text to read, and then the text encoded in UTF-8, and returns the string"""

        strlen = self.read_int(log=False)
        if not strlen:
            return ''
        res = to_bytes('')
        while len(res) < strlen:
            res = res + self.sock.recv(strlen - len(res))

        res = utf_8.decode(res)[0]
        if sys.version_info[0] == 2 and sys.platform != 'cli':
            # Py 2.x, we want an ASCII string if possible
            try:
                res = ascii.Codec.encode(res)[0]
            except UnicodeEncodeError:
                pass

        if log:
            logging.debug('read_string: {}'.format(res))

        return res


class PydevWriter(AbstractWriterThread):
    """writes commands to the pydev debugger"""

    def __init__(self, writer, reader):
        super().__init__()
        self.writer = writer
        self.reader = reader

    def run(self):
        try:
            logging.debug('pydev writer initialized')
            self.start_socket()
            self.write_add_breakpoint(9, 'main')
            self.write_make_initial_run()

            thread_id, frame_id, line = self.wait_for_breakpoint_hit(
                '111', True)

            # In this test we check that the three arrays of different shapes, sizes and types
            # are all resolved properly as ndarrays.

            # First pass check is that we have all three expected variables defined
            self.write_get_frame(thread_id, frame_id)
            self.wait_for_multiple_vars((
                '<var name="smallarray" type="ndarray" qualifier="numpy" value="ndarray%253A %255B  0.%252B1.j   1.%252B1.j   2.%252B1.j   3.%252B1.j   4.%252B1.j   5.%252B1.j   6.%252B1.j   7.%252B1.j%250A   8.%252B1.j   9.%252B1.j  10.%252B1.j  11.%252B1.j  12.%252B1.j  13.%252B1.j  14.%252B1.j  15.%252B1.j%250A  16.%252B1.j  17.%252B1.j  18.%252B1.j  19.%252B1.j  20.%252B1.j  21.%252B1.j  22.%252B1.j  23.%252B1.j%250A  24.%252B1.j  25.%252B1.j  26.%252B1.j  27.%252B1.j  28.%252B1.j  29.%252B1.j  30.%252B1.j  31.%252B1.j%250A  32.%252B1.j  33.%252B1.j  34.%252B1.j  35.%252B1.j  36.%252B1.j  37.%252B1.j  38.%252B1.j  39.%252B1.j%250A  40.%252B1.j  41.%252B1.j  42.%252B1.j  43.%252B1.j  44.%252B1.j  45.%252B1.j  46.%252B1.j  47.%252B1.j%250A  48.%252B1.j  49.%252B1.j  50.%252B1.j  51.%252B1.j  52.%252B1.j  53.%252B1.j  54.%252B1.j  55.%252B1.j%250A  56.%252B1.j  57.%252B1.j  58.%252B1.j  59.%252B1.j  60.%252B1.j  61.%252B1.j  62.%252B1.j  63.%252B1.j%250A  64.%252B1.j  65.%252B1.j  66.%252B1.j  67.%252B1.j  68.%252B1.j  69.%252B1.j  70.%252B1.j  71.%252B1.j%250A  72.%252B1.j  73.%252B1.j  74.%252B1.j  75.%252B1.j  76.%252B1.j  77.%252B1.j  78.%252B1.j  79.%252B1.j%250A  80.%252B1.j  81.%252B1.j  82.%252B1.j  83.%252B1.j  84.%252B1.j  85.%252B1.j  86.%252B1.j  87.%252B1.j%250A  88.%252B1.j  89.%252B1.j  90.%252B1.j  91.%252B1.j  92.%252B1.j  93.%252B1.j  94.%252B1.j  95.%252B1.j%250A  96.%252B1.j  97.%252B1.j  98.%252B1.j  99.%252B1.j%255D" isContainer="True" />',
                '<var name="bigarray" type="ndarray" qualifier="numpy" value="ndarray%253A %255B%255B    0     1     2 ...%252C  9997  9998  9999%255D%250A %255B10000 10001 10002 ...%252C 19997 19998 19999%255D%250A %255B20000 20001 20002 ...%252C 29997 29998 29999%255D%250A ...%252C %250A %255B70000 70001 70002 ...%252C 79997 79998 79999%255D%250A %255B80000 80001 80002 ...%252C 89997 89998 89999%255D%250A %255B90000 90001 90002 ...%252C 99997 99998 99999%255D%255D" isContainer="True" />',
                '<var name="hugearray" type="ndarray" qualifier="numpy" value="ndarray%253A %255B      0       1       2 ...%252C 9999997 9999998 9999999%255D" isContainer="True" />',
            ))
            self.write_run_thread(thread_id)
            self.finished_ok = True
        except:
            logging.exception('PydevWriter.run failed')

    def start_socket(self, port=None):
        from _pydev_bundle.pydev_localhost import get_socket_name
        logging.debug('start_socket')

        if port is None:
            socket_name = get_socket_name()
        else:
            socket_name = (pydev_localhost.get_localhost(), port)

        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.port = socket_name[1]
        logging.debug('pydev port: {}'.format(self.port))
        self.sock.bind(('127.0.0.1', self.port))
        self.sock.listen(1)
        self.sock, addr = self.sock.accept()

        logging.debug('connected from {}'.format(addr))
        self.reader_thread = PydevReader(self.sock, self.writer)
        self.reader_thread.start()

        self._sequence = -1
        # initial command is always the version
        self.write_version()
        logging.debug('start_socket returned')


class PydevReader(ReaderThread):
    """"reads information from the pydev debugger"""

    def __init__(self, sock, writer):
        super().__init__(sock)
        self.writer = writer

    def handle_message(self):
        msg = self.get_next_message()
        # handle message

    def read_messages(self):
        while True:
            try:
                self.handle_message()
            except AssertionError:
                break

    def get_next_message(self):
        try:
            msg = self._queue.get(block=False)
        except:
            raise AssertionError('No message was written in 15 seconds.')
        else:
            frame = sys._getframe().f_back
            frame_info = ' --  File "%s", line %s, in %s\n' % (
                frame.f_code.co_filename, frame.f_lineno, frame.f_code.co_name)
            frame_info += ' --  File "%s", line %s, in %s\n' % (
                frame.f_back.f_code.co_filename, frame.f_back.f_lineno,
                frame.f_back.f_code.co_name)
            frame = None
            sys.stdout.write(
                'Message returned in get_next_message(): %s --  ctx: %s, returned to:\n%s\n'
            )
        return msg

    def run(self):
        logging.debug('pydev reader initialized')
        try:
            buf = ''
            while not self._kill:
                l = self.sock.recv(1024)
                if IS_PY3K:
                    l = l.decode('utf-8')
                self.all_received.append(l)
                buf += l

                while '\n' in buf:
                    # Print each part...
                    i = buf.index('\n') + 1
                    last_received = buf[:i]
                    buf = buf[i:]

                    if SHOW_WRITES_AND_READS:
                        print('Test Reader Thread Received %s' %
                              (last_received, ))

                    self._queue.put(last_received)

                self.read_messages()
        except:
            logging.exception('PydevReader.run failed')
        finally:
            del self.all_received[:]
