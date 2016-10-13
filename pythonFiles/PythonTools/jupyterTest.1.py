# http://ipython.org/ipython-doc/3/development/messaging.html
# http://pydoc.net/Python/magni/1.4.0/magni.tests.ipynb_examples/

import os
import warnings
try:
    from Queue import Empty  # Python 2
except ImportError:
    from queue import Empty  # Python 3

# The great "support IPython 2, 3, 4" strat begins
try:
    import jupyter
except ImportError:
    jupyter_era = False
else:
    jupyter_era = True

if jupyter_era:
    # Jupyter / IPython 4.x
    from jupyter_client import KernelManager
else:
    from IPython.kernel import KernelManager

# End of the great "support IPython 2, 3, 4" strat


def _check_ipynb():
    kernel_manager = KernelManager()
    kernel_manager.start_kernel()
    kernel_client = kernel_manager.client()
    kernel_client.start_channels()

    try:
        # IPython 3.x
        kernel_client.wait_for_ready()
        iopub = kernel_client
        shell = kernel_client
    except AttributeError:
        # Ipython 2.x
        # Based on https://github.com/paulgb/runipy/pull/49/files
        iopub = kernel_client.iopub_channel
        shell = kernel_client.shell_channel
        shell.get_shell_msg = shell.get_msg
        iopub.get_iopub_msg = iopub.get_msg

    successes = 0
    failures = 0
    errors = 0

    report = ''
    try:
        test_results = _execute_cell("print('Hello World')", shell, iopub)
    except RuntimeError as e:
        report += ('{!s} in cell number: {}'
                   .format(e, 'cell.prompt_number'))
        errors += 1
        print('crap execute')

    try:
        str_test_results = [
            '(for out {})\n'.format(k) + '\n'.join(
                [' : '.join([str(key), str(val)])
                    for key, val in t.items()
                    if key not in ('metadata', 'png')]
            ) for k, t in enumerate(test_results)]
    except:
        print('crap')
    else:
        report += '\n' * 2 + '~' * 40
        report += (
            '\nFailure in {}:{}\nGot: {}'
        ).format('notebook.metadata.name',
                 'cell.prompt_number',
                 '\n'.join(str_test_results))

    kernel_client.stop_channels()
    kernel_manager.shutdown_kernel()

    passed = not (failures or errors)

    print(report)


def _execute_cell(code, shell, iopub, timeout=300):
    """
    Execute an IPython Notebook Cell and return the cell output.

    Parameters
    ----------
    cell : str
        The code to be executed in a python kernel
    shell : IPython.kernel.blocking.channels.BlockingShellChannel
        The shell channel which the cell is submitted to for execution.
    iopub : IPython.kernel.blocking.channels.BlockingIOPubChannel
        The iopub channel used to retrieve the result of the execution.
    timeout : int
        The number of seconds to wait for the execution to finish before giving
        up.

    Returns
    -------
    cell_outputs : list
        The list of NotebookNodes holding the result of the execution.

    """

    # Execute input
    shell.execute(code)
    exe_result = shell.get_shell_msg(timeout=timeout)
    print('exe_result')
    print(exe_result)
    print('')
    if exe_result['content']['status'] == 'error':
        raise RuntimeError('Failed to execute cell due to error: {!r}'.format(
            str(exe_result['content']['evalue'])))

    cell_outputs = list()

    # Poll for iopub messages until no more messages are available
    while True:
        try:
            msg = iopub.get_iopub_msg(timeout=0.5)
            print('get_iopub_msg')
            print('msg')
            print(msg)
            print('')
        except Empty:
            print('get_iopub_msg')
            print('done')
            print('')
            break

        msg_type = msg['msg_type']
        if msg_type in ('status', 'pyin', 'execute_input', 'execute_result'):
            continue

        content = msg['content']
        node = Node()

        if msg_type == 'stream':
            node.stream = content['name']
            if 'text' in content:
                # v4 notebook format
                node.text = content['text']
            else:
                # v3 notebook format
                node.text = content['data']
        elif msg_type in ('display_data', 'pyout'):
            node['metadata'] = content['metadata']
            for mime, data in content['data'].items():
                attr = mime.split('/')[-1].lower()
                attr = attr.replace('+xml', '').replace('plain', 'text')
                setattr(node, attr, data)
            if msg_type == 'pyout':
                node.prompt_number = content['execution_count']
        elif msg_type == 'pyerr':
            node.ename = content['ename']
            node.evalue = content['evalue']
            node.traceback = content['traceback']
        else:
            raise RuntimeError('Unhandled iopub message of type: {}'.format(
                msg_type))

        cell_outputs.append(node)

    return cell_outputs

class Node:
    def __init__(self):
        self.stream = None
        self.text = None
        self.ename = None
        self.evalue = None
        self.traceback = None

_check_ipynb()
