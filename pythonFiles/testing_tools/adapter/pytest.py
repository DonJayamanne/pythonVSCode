from __future__ import absolute_import

import os.path

import pytest

from .errors import UnsupportedCommandError
from .info import TestInfo, TestPath, ParentInfo


def add_cli_subparser(cmd, name, parent):
    """Add a new subparser to the given parent and add args to it."""
    parser = parent.add_parser(name)
    if cmd == 'discover':
        # For now we don't have any tool-specific CLI options to add.
        pass
    else:
        raise UnsupportedCommandError(cmd)
    return parser


def discover(pytestargs=None, simple=False,
             _pytest_main=pytest.main, _plugin=None):
    """Return the results of test discovery."""
    if _plugin is None:
        _plugin = TestCollector()

    pytestargs = _adjust_pytest_args(pytestargs)
    ec = _pytest_main(pytestargs, [_plugin])
    if ec != 0:
        raise Exception('pytest discovery failed (exit code {})'.format(ec))
    if not _plugin._started:
        raise Exception('pytest discovery did not start')
    return (
            _plugin._tests.parents,
            #[p._replace(
            #    id=p.id.lstrip('.' + os.path.sep),
            #    parentid=p.parentid.lstrip('.' + os.path.sep),
            #    )
            # for p in _plugin._tests.parents],
            list(_plugin._tests),
            )


def _adjust_pytest_args(pytestargs):
    pytestargs = list(pytestargs) if pytestargs else []
    # Duplicate entries should be okay.
    pytestargs.insert(0, '--collect-only')
    pytestargs.insert(0, '-pno:terminal')
    # TODO: pull in code from:
    #  src/client/unittests/pytest/services/discoveryService.ts
    #  src/client/unittests/pytest/services/argsService.ts
    return pytestargs


class TestCollector(object):
    """This is a pytest plugin that collects the discovered tests."""

    def __init__(self, tests=None):
        if tests is None:
            tests = DiscoveredTests
        self._tests = tests
        self._started = False

    # Relevant plugin hooks:
    #  https://docs.pytest.org/en/latest/reference.html#collection-hooks

    def pytest_collection_modifyitems(self, session, config, items):
        self._started = True
        self._tests.reset()
        for item in items:
            test, suiteids = _parse_item(item)
            self._tests.add_test(test, suiteids)

    # This hook is not specified in the docs, so we also provide
    # the "modifyitems" hook just in case.
    def pytest_collection_finish(self, session):
        self._started = True
        try:
            items = session.items
        except AttributeError:
            # TODO: Is there an alternative?
            return
#        print(', '.join(k for k in dir(items[0]) if k[0].islower()))
        self._tests.reset()
        for item in items:
#            print(' ', item.user_properties)
#            print(' ', item.own_markers)
#            print(' ', list(item.iter_markers()))
#            print()
            test, suiteids = _parse_item(item)
            self._tests.add_test(test, suiteids)


class DiscoveredTests(object):

    def __init__(self):
        self.reset()

    def __len__(self):
        return len(self._tests)

    def __getitem__(self, index):
        return self._tests[index]

    @property
    def parents(self):
        return sorted(self._parents.values(), key=lambda v: (v.root or v.name, v.id))

    def reset(self):
        self._parents = {}
        self._tests = []

    def add_test(self, test, suiteids):
        parentid = self._ensure_parent(test.path, test.parentid, suiteids)
        test = test._replace(parentid=parentid)
        if not test.id.startswith('.' + os.path.sep):
            test = test._replace(id=os.path.join('.', test.id))
        self._tests.append(test)

    def _ensure_parent(self, path, parentid, suiteids):
        if not parentid.startswith('.' + os.path.sep):
            parentid = os.path.join('.', parentid)
        fileid = self._ensure_file(path.root, path.relfile)
        rootdir = path.root

        fullsuite, _, funcname = path.func.rpartition('.')
        suiteid = self._ensure_suites(fullsuite, rootdir, fileid, suiteids)
        parent = suiteid if suiteid else fileid

        if path.sub:
            if (rootdir, parentid) not in self._parents:
                funcinfo = ParentInfo(parentid, 'function', funcname,
                                      rootdir, parent)
                self._parents[(rootdir, parentid)] = funcinfo
        elif parent != parentid:
            print(parent, parentid)
            # TODO: What to do?
            raise NotImplementedError
        return parentid

    def _ensure_file(self, rootdir, relfile):
        if (rootdir, '.') not in self._parents:
            self._parents[(rootdir, '.')] = ParentInfo('.', 'folder', rootdir)
        if relfile.startswith('.' + os.path.sep):
            fileid = relfile
        else:
            fileid = relfile = os.path.join('.', relfile)

        if (rootdir, fileid) not in self._parents:
            folderid, filebase = os.path.split(fileid)
            fileinfo = ParentInfo(fileid, 'file', filebase, rootdir, folderid)
            self._parents[(rootdir, fileid)] = fileinfo

            while folderid != '.' and (rootdir, folderid) not in self._parents:
                parentid, name = os.path.split(folderid)
                folderinfo = ParentInfo(folderid, 'folder', name, rootdir, parentid)
                self._parents[(rootdir, folderid)] = folderinfo
                folderid = parentid
        return relfile

    def _ensure_suites(self, fullsuite, rootdir, fileid, suiteids):
        if not fullsuite:
            if suiteids:
                # TODO: What to do?
                raise NotImplementedError
            return None
        if len(suiteids) != fullsuite.count('.') + 1:
            # TODO: What to do?
            raise NotImplementedError

        suiteid = suiteids.pop()
        if not suiteid.startswith('.' + os.path.sep):
            suiteid = os.path.join('.', suiteid)
        final = suiteid
        while '.' in fullsuite and (rootdir, suiteid) not in self._parents:
            parentid = suiteids.pop()
            if not parentid.startswith('.' + os.path.sep):
                parentid = os.path.join('.', parentid)
            fullsuite, _, name = fullsuite.rpartition('.')
            suiteinfo = ParentInfo(suiteid, 'suite', name, rootdir, parentid)
            self._parents[(rootdir, suiteid)] = suiteinfo

            suiteid = parentid
        else:
            name = fullsuite
            suiteinfo = ParentInfo(suiteid, 'suite', name, rootdir, fileid)
            self._parents[(rootdir, suiteid)] = suiteinfo
        return final


def _parse_item(item):
    """
    (pytest.Collector)
        pytest.Session
        pytest.Package
        pytest.Module
        pytest.Class
        (pytest.File)
    (pytest.Item)
        pytest.Function
    """
    # Figure out the file.
    filename, lineno, fullname = item.location
    if not str(item.fspath).endswith(os.path.sep + filename):
        raise NotImplementedError
    testroot = str(item.fspath)[:-len(filename)].rstrip(os.path.sep)
    if os.path.sep in filename:
        relfile = filename
    else:
        relfile = os.path.join('.', filename)

    # Figure out the func, suites, and subs.
    (fileid, suites, suiteids, funcname, funcid, parameterized
     ) = _parse_node_id(item.nodeid)
    if item.function.__name__ != funcname:
        # TODO: What to do?
        raise NotImplementedError
    if fileid != filename:
        # TODO: What to do?
        raise NotImplementedError
    if suites:
        testfunc = '.'.join(suites) + '.' + funcname
    else:
        testfunc = funcname
    if fullname != testfunc + parameterized:
        # TODO: What to do?
        raise NotImplementedError

    # Sort out the parent.
    if parameterized:
        parentid = funcid
    elif suites:
        parentid = suiteids[-1]
    else:
        parentid = fileid

    # Sort out markers.
    #  See: https://docs.pytest.org/en/latest/reference.html#marks
    markers = set()
    for marker in item.own_markers:
        if marker.name == 'parameterize':
            # We've already covered these.
            continue
        elif marker.name == 'skip':
            markers.add('skip')
        elif marker.name == 'skipif':
            markers.add('skip-if')
        elif marker.name == 'xfail':
            markers.add('expected-failure')
        # TODO: Support other markers?

    test = TestInfo(
        id=item.nodeid,
        name=item.name,
        path=TestPath(
            root=testroot,
            relfile=relfile,
            func=testfunc,
            sub=[parameterized] if parameterized else None,
            ),
        lineno=lineno,
        markers=sorted(markers) if markers else None,
        parentid=parentid,
        )
    return test, suiteids


def _parse_node_id(nodeid):
    parameterized = ''
    if nodeid.endswith(']'):
        funcid, sep, parameterized = nodeid.rpartition('[')
        if not sep:
            # TODO: What to do?
            raise NotImplementedError
        parameterized = sep + parameterized
    else:
        funcid = nodeid

    parentid, _, funcname = funcid.rpartition('::')
    if not funcname:
        # TODO: What to do?  We expect at least a filename and a function
        raise NotImplementedError

    suites = []
    suiteids = []
    while '::' in parentid:
        suiteids.insert(0, parentid)
        parentid, _, suitename = parentid.rpartition('::')
        suites.insert(0, suitename)
    fileid = parentid

    return fileid, suites, suiteids, funcname, funcid, parameterized
