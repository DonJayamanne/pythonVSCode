# Query Jupyter server for defined variables list
# Tested on 2.7 and 3.6
from sys import getsizeof as _VSCODE_getsizeof
import json as _VSCODE_json

# _VSCode_supportsDataExplorer will contain our list of data explorer supported types
_VSCode_supportsDataExplorer = "['list', 'Series', 'dict', 'ndarray', 'DataFrame']"

try:
    from IPython import get_ipython as _VSCODE_get_ipython
    # who_ls is a Jupyter line magic to fetch currently defined vars
    _VSCode_JupyterVars = _VSCODE_get_ipython().run_line_magic('who_ls', '')

    _VSCode_output = []
    for _VSCode_var in _VSCode_JupyterVars:
        try:
            _VSCode_type = type(eval(_VSCode_var))
            _VSCode_output.append({'name': _VSCode_var, 'type': _VSCode_type.__name__, 'size': _VSCODE_getsizeof(_VSCode_var), 'supportsDataExplorer': _VSCode_type.__name__ in _VSCode_supportsDataExplorer })
            del _VSCode_type
            del _VSCode_var
        except:
            pass
except:
    pass

try:
    _VSCode_output = []
    for _VSCode_var in dir():
        try:
            if _VSCode_var.startswith("__") == 0 and _VSCode_var not in imports:
                _VSCode_type = type(eval(_VSCode_var))
                _VSCode_output.append({'name': _VSCode_var, 'type': _VSCode_type.__name__, 'size': _VSCODE_getsizeof(_VSCode_var), 'supportsDataExplorer': _VSCode_type.__name__ in _VSCode_supportsDataExplorer })
                del _VSCode_type
                del _VSCode_var
        except:
            pass
except:
    pass

print(_VSCODE_json.dumps(_VSCode_output))

try:
    del _VSCODE_get_ipython
    del _VSCode_output
    del _VSCode_supportsDataExplorer
    del _VSCode_JupyterVars
    del _VSCODE_json
    del _VSCODE_getsizeof
    pass
except:
    pass
