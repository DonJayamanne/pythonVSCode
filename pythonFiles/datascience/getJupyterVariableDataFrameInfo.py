# Query Jupyter server for the info about a dataframe
import json as _VSCODE_json
import pandas as _VSCODE_pd
import pandas.io.json as _VSCODE_pd_json

# _VSCode_sub_supportsDataExplorer will contain our list of data explorer supported types
_VSCode_supportsDataExplorer = "['list', 'Series', 'dict', 'ndarray', 'DataFrame']"

# In IJupyterVariables.getValue this '_VSCode_JupyterTestValue' will be replaced with the json stringified value of the target variable
# Indexes off of _VSCODE_targetVariable need to index types that are part of IJupyterVariable
_VSCODE_targetVariable = _VSCODE_json.loads('_VSCode_JupyterTestValue')

# First check to see if we are a supported type, this prevents us from adding types that are not supported
# and also keeps our types in sync with what the variable explorer says that we support
if _VSCODE_targetVariable['type'] not in _VSCode_supportsDataExplorer:
    del _VSCode_supportsDataExplorer
    print(_VSCODE_json.dumps(_VSCODE_targetVariable))
    del _VSCODE_targetVariable
else:
    del _VSCode_supportsDataExplorer
    _VSCODE_evalResult = eval(_VSCODE_targetVariable['name'])

    # Figure out shape if not already there. Use the shape to compute the row count
    if (hasattr(_VSCODE_evalResult, 'shape')):
        try:
            # Get a bit more restrictive with exactly what we want to count as a shape, since anything can define it
            if isinstance(_VSCODE_evalResult.shape, tuple):
                _VSCODE_targetVariable['rowCount'] = _VSCODE_evalResult.shape[0]
        except TypeError:
            _VSCODE_targetVariable['rowCount'] = 0
    elif (hasattr(_VSCODE_evalResult, '__len__')):
        try:
            _VSCODE_targetVariable['rowCount'] = len(_VSCODE_evalResult)
        except TypeError:
            _VSCODE_targetVariable['rowCount'] = 0

    # Turn the eval result into a df
    _VSCODE_df = _VSCODE_evalResult
    if isinstance(_VSCODE_evalResult, list):
        _VSCODE_df = _VSCODE_pd.DataFrame(_VSCODE_evalResult)
    elif isinstance(_VSCODE_evalResult, _VSCODE_pd.Series):
        _VSCODE_df = _VSCODE_pd.Series.to_frame(_VSCODE_evalResult)
    elif isinstance(_VSCODE_evalResult, dict):
        _VSCODE_evalResult = _VSCODE_pd.Series(_VSCODE_evalResult)
        _VSCODE_df = _VSCODE_pd.Series.to_frame(_VSCODE_evalResult)
    elif _VSCODE_targetVariable['type'] == 'ndarray':
        _VSCODE_df = _VSCODE_pd.DataFrame(_VSCODE_evalResult)

    # If any rows, use pandas json to convert a single row to json. Extract
    # the column names and types from the json so we match what we'll fetch when
    # we ask for all of the rows
    if _VSCODE_targetVariable['rowCount']:
        try:
            _VSCODE_row = _VSCODE_df.iloc[0:1]
            _VSCODE_json_row = _VSCODE_pd_json.to_json(None, _VSCODE_row, date_format='iso')
            _VSCODE_columnNames = list(_VSCODE_json.loads(_VSCODE_json_row))
            del _VSCODE_row
            del _VSCODE_json_row
        except:
            _VSCODE_columnNames = list(_VSCODE_df)
    else:
        _VSCODE_columnNames = list(_VSCODE_df)

    # Compute the index column. It may have been renamed
    _VSCODE_indexColumn = _VSCODE_df.index.name if _VSCODE_df.index.name else 'index'
    _VSCODE_columnTypes = list(_VSCODE_df.dtypes)
    del _VSCODE_df

    # Make sure the index column exists
    if _VSCODE_indexColumn not in _VSCODE_columnNames:
        _VSCODE_columnNames.insert(0, _VSCODE_indexColumn)
        _VSCODE_columnTypes.insert(0, 'int64')

    # Then loop and generate our output json
    _VSCODE_columns = []
    for _VSCODE_n in range(0, len(_VSCODE_columnNames)):
        _VSCODE_column_type = _VSCODE_columnTypes[_VSCODE_n]
        _VSCODE_column_name = str(_VSCODE_columnNames[_VSCODE_n])
        _VSCODE_colobj = {}
        _VSCODE_colobj['key'] = _VSCODE_column_name
        _VSCODE_colobj['name'] = _VSCODE_column_name
        _VSCODE_colobj['type'] = str(_VSCODE_column_type)
        _VSCODE_columns.append(_VSCODE_colobj)
        del _VSCODE_column_name
        del _VSCODE_column_type

    del _VSCODE_columnNames
    del _VSCODE_columnTypes

    # Save this in our target
    _VSCODE_targetVariable['columns'] = _VSCODE_columns
    _VSCODE_targetVariable['indexColumn'] = _VSCODE_indexColumn
    del _VSCODE_columns
    del _VSCODE_indexColumn


    # Transform this back into a string
    print(_VSCODE_json.dumps(_VSCODE_targetVariable))
    del _VSCODE_targetVariable

    # Cleanup imports
    del _VSCODE_json
    del _VSCODE_pd
    del _VSCODE_pd_json
