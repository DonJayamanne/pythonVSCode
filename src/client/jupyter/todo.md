- startup code (for %matplotlib inline)
- drop down in result view to (append or clear and display)
- button in result view to clear results
- Do we need the ability to copy an image (difficult, for now lets leave this - wait for user feedback)
- debugging? (check out pycharm and atom, how debugging is done, if at all)
    Atom (hydrogen) doesn't seem to support this
- configuring the path to jupyter?
    pycharm seems to support this, we need might need this
    it looks like you need to set the path to the conda python interpreter (that's what was done in pycharm)
    check how paths are setup in atom hydrogen
- is each python environment a separate kernel?
    don't know, need to check
- jupyter and ipython would be located in the same directory as the python interpretre
    so all you need to do is set the path to jupyter (//anaconda/bin/python)
    Use existing code that will use the path of the interpretter when looking for executables
    Similar to what we do today in utils.execPythonFile

- cell line height