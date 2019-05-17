# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

from __future__ import print_function, unicode_literals

try:
    from io import StringIO
except ImportError:  # 2.7
    from StringIO import StringIO
import os
import os.path
import sys
import unittest

from ....util import Stub, StubProxy
from testing_tools.adapter.info import TestInfo, TestPath, ParentInfo
from testing_tools.adapter.pytest._discovery import (
        discover, TestCollector, DiscoveredTests
        )
import pytest


class StubPyTest(StubProxy):

    def __init__(self, stub=None):
        super(StubPyTest, self).__init__(stub, 'pytest')
        self.return_main = 0

    def main(self, args, plugins):
        self.add_call('main', None, {'args': args, 'plugins': plugins})
        return self.return_main


class StubPlugin(StubProxy):

    _started = True

    def __init__(self, stub=None, tests=None):
        super(StubPlugin, self).__init__(stub, 'plugin')
        if tests is None:
            tests = StubDiscoveredTests(self.stub)
        self._tests = tests

    def __getattr__(self, name):
        if not name.startswith('pytest_'):
            raise AttributeError(name)
        def func(*args, **kwargs):
            self.add_call(name, args or None, kwargs or None)
        return func


class StubDiscoveredTests(StubProxy):

    NOT_FOUND = object()

    def __init__(self, stub=None):
        super(StubDiscoveredTests, self).__init__(stub, 'discovered')
        self.return_items = []
        self.return_parents = []

    def __len__(self):
        self.add_call('__len__', None, None)
        return len(self.return_items)

    def __getitem__(self, index):
        self.add_call('__getitem__', (index,), None)
        return self.return_items[index]

    @property
    def parents(self):
        self.add_call('parents', None, None)
        return self.return_parents

    def reset(self):
        self.add_call('reset', None, None)

    def add_test(self, test, suiteids):
        self.add_call('add_test', None, {'test': test, 'suiteids': suiteids})


class FakeFunc(object):

    def __init__(self, name):
        self.__name__ = name


class FakeMarker(object):

    def __init__(self, name):
        self.name = name


class StubPytestItem(StubProxy):

    kind = 'Function'

    _debugging = False
    _hasfunc = True

    def __init__(self, stub=None, **attrs):
        super(StubPytestItem, self).__init__(stub, 'pytest.Item')
        if attrs.get('function') is None:
            attrs.pop('function', None)
            self._hasfunc = False

        attrs.setdefault('user_properties', [])

        self.__dict__.update(attrs)

        if 'own_markers' not in attrs:
            self.own_markers = ()

    def __getattr__(self, name):
        if not self._debugging:
            self.add_call(name + ' (attr)', None, None)
        if name == 'function':
            if not self._hasfunc:
                raise AttributeError(name)
        def func(*args, **kwargs):
            self.add_call(name, args or None, kwargs or None)
        return func


class StubPytestSession(StubProxy):

    def __init__(self, stub=None):
        super(StubPytestSession, self).__init__(stub, 'pytest.Session')

    def __getattr__(self, name):
        self.add_call(name + ' (attr)', None, None)
        def func(*args, **kwargs):
            self.add_call(name, args or None, kwargs or None)
        return func


class StubPytestConfig(StubProxy):

    def __init__(self, stub=None):
        super(StubPytestConfig, self).__init__(stub, 'pytest.Config')

    def __getattr__(self, name):
        self.add_call(name + ' (attr)', None, None)
        def func(*args, **kwargs):
            self.add_call(name, args or None, kwargs or None)
        return func


##################################
# tests

class DiscoverTests(unittest.TestCase):

    DEFAULT_ARGS = [
        '--collect-only',
        ]

    def test_basic(self):
        stub = Stub()
        stubpytest = StubPyTest(stub)
        plugin = StubPlugin(stub)
        expected = []
        plugin.discovered = expected

        parents, tests = discover([], _pytest_main=stubpytest.main, _plugin=plugin)

        self.assertEqual(parents, [])
        self.assertEqual(tests, expected)
        self.assertEqual(stub.calls, [
            ('pytest.main', None, {'args': self.DEFAULT_ARGS,
                                   'plugins': [plugin]}),
            ('discovered.parents', None, None),
            ('discovered.__len__', None, None),
            ('discovered.__getitem__', (0,), None),
            ])

    def test_failure(self):
        stub = Stub()
        pytest = StubPyTest(stub)
        pytest.return_main = 2
        plugin = StubPlugin(stub)

        with self.assertRaises(Exception):
            discover([], _pytest_main=pytest.main, _plugin=plugin)

        self.assertEqual(stub.calls, [
            ('pytest.main', None, {'args': self.DEFAULT_ARGS,
                                   'plugins': [plugin]}),
            ])

    def test_no_tests_found(self):
        stub = Stub()
        pytest = StubPyTest(stub)
        pytest.return_main = 5
        plugin = StubPlugin(stub)
        expected = []
        plugin.discovered = expected

        parents, tests = discover([], _pytest_main=pytest.main, _plugin=plugin)

        self.assertEqual(parents, [])
        self.assertEqual(tests, expected)
        self.assertEqual(stub.calls, [
            ('pytest.main', None, {'args': self.DEFAULT_ARGS,
                                   'plugins': [plugin]}),
            ('discovered.parents', None, None),
            ('discovered.__len__', None, None),
            ('discovered.__getitem__', (0,), None),
            ])

    def test_stdio_hidden(self):
        pytest_stdout = 'spamspamspamspamspamspamspammityspam'
        stub = Stub()
        def fake_pytest_main(args, plugins):
            stub.add_call('pytest.main', None, {'args': args,
                                                'plugins': plugins})
            print(pytest_stdout, end='')
            return 0
        plugin = StubPlugin(stub)
        plugin.discovered = []
        buf = StringIO()

        sys.stdout = buf
        try:
            discover([], hidestdio=True,
                     _pytest_main=fake_pytest_main, _plugin=plugin)
        finally:
            sys.stdout = sys.__stdout__
        captured = buf.getvalue()

        self.assertEqual(captured, '')
        self.assertEqual(stub.calls, [
            ('pytest.main', None, {'args': self.DEFAULT_ARGS,
                                   'plugins': [plugin]}),
            ('discovered.parents', None, None),
            ('discovered.__len__', None, None),
            ('discovered.__getitem__', (0,), None),
            ])

    def test_stdio_not_hidden(self):
        pytest_stdout = 'spamspamspamspamspamspamspammityspam'
        stub = Stub()
        def fake_pytest_main(args, plugins):
            stub.add_call('pytest.main', None, {'args': args,
                                                'plugins': plugins})
            print(pytest_stdout, end='')
            return 0
        plugin = StubPlugin(stub)
        plugin.discovered = []
        buf = StringIO()

        sys.stdout = buf
        try:
            discover([], hidestdio=False,
                     _pytest_main=fake_pytest_main, _plugin=plugin)
        finally:
            sys.stdout = sys.__stdout__
        captured = buf.getvalue()

        self.assertEqual(captured, pytest_stdout)
        self.assertEqual(stub.calls, [
            ('pytest.main', None, {'args': self.DEFAULT_ARGS,
                                   'plugins': [plugin]}),
            ('discovered.parents', None, None),
            ('discovered.__len__', None, None),
            ('discovered.__getitem__', (0,), None),
            ])


class CollectorTests(unittest.TestCase):

    def test_modifyitems(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        config = StubPytestConfig(stub)
        collector = TestCollector(tests=discovered)

        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile1 = './test_spam.py'.replace('/', os.path.sep)
        relfile2 = 'x/y/z/test_eggs.py'.replace('/', os.path.sep)
        relfileid2 = os.path.join('.', relfile2)

        collector.pytest_collection_modifyitems(session, config, [
            StubPytestItem(
                stub,
                nodeid='test_spam.py::SpamTests::test_one',
                name='test_one',
                location=('test_spam.py', 12, 'SpamTests.test_one'),
                fspath=os.path.join(testroot, 'test_spam.py'),
                function=FakeFunc('test_one'),
                ),
            StubPytestItem(
                stub,
                nodeid='test_spam.py::SpamTests::test_other',
                name='test_other',
                location=('test_spam.py', 19, 'SpamTests.test_other'),
                fspath=os.path.join(testroot, 'test_spam.py'),
                function=FakeFunc('test_other'),
                ),
            StubPytestItem(
                stub,
                nodeid='test_spam.py::test_all',
                name='test_all',
                location=('test_spam.py', 144, 'test_all'),
                fspath=os.path.join(testroot, 'test_spam.py'),
                function=FakeFunc('test_all'),
                ),
            StubPytestItem(
                stub,
                nodeid='test_spam.py::test_each[10-10]',
                name='test_each[10-10]',
                location=('test_spam.py', 273, 'test_each[10-10]'),
                fspath=os.path.join(testroot, 'test_spam.py'),
                function=FakeFunc('test_each'),
                ),
            StubPytestItem(
                stub,
                nodeid=relfile2 + '::All::BasicTests::test_first',
                name='test_first',
                location=(relfile2, 31, 'All.BasicTests.test_first'),
                fspath=os.path.join(testroot, relfile2),
                function=FakeFunc('test_first'),
                ),
            StubPytestItem(
                stub,
                nodeid=relfile2 + '::All::BasicTests::test_each[1+2-3]',
                name='test_each[1+2-3]',
                location=(relfile2, 62, 'All.BasicTests.test_each[1+2-3]'),
                fspath=os.path.join(testroot, relfile2),
                function=FakeFunc('test_each'),
                own_markers=[FakeMarker(v) for v in [
                    # supported
                    'skip', 'skipif', 'xfail',
                    # duplicate
                    'skip',
                    # ignored (pytest-supported)
                    'parameterize', 'usefixtures', 'filterwarnings',
                    # ignored (custom)
                    'timeout',
                    ]],
                ),
            ])

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                suiteids=[relfile1 + '::SpamTests'],
                test=TestInfo(
                    id=relfile1 + '::SpamTests::test_one',
                    name='test_one',
                    path=TestPath(
                        root=testroot,
                        relfile=relfile1,
                        func='SpamTests.test_one',
                        sub=None,
                        ),
                    source='{}:{}'.format(relfile1, 13),
                    markers=None,
                    parentid=relfile1 + '::SpamTests',
                    ),
                )),
            ('discovered.add_test', None, dict(
                suiteids=[relfile1 + '::SpamTests'],
                test=TestInfo(
                    id=relfile1 + '::SpamTests::test_other',
                    name='test_other',
                    path=TestPath(
                        root=testroot,
                        relfile=relfile1,
                        func='SpamTests.test_other',
                        sub=None,
                        ),
                    source='{}:{}'.format(relfile1, 20),
                    markers=None,
                    parentid=relfile1 + '::SpamTests',
                    ),
                )),
            ('discovered.add_test', None, dict(
                suiteids=[],
                test=TestInfo(
                    id=relfile1 + '::test_all',
                    name='test_all',
                    path=TestPath(
                        root=testroot,
                        relfile=relfile1,
                        func='test_all',
                        sub=None,
                        ),
                    source='{}:{}'.format(relfile1, 145),
                    markers=None,
                    parentid=relfile1,
                    ),
                )),
            ('discovered.add_test', None, dict(
                suiteids=[],
                test=TestInfo(
                    id=relfile1 + '::test_each[10-10]',
                    name='test_each[10-10]',
                    path=TestPath(
                        root=testroot,
                        relfile=relfile1,
                        func='test_each',
                        sub=['[10-10]'],
                        ),
                    source='{}:{}'.format(relfile1, 274),
                    markers=None,
                    parentid=relfile1 + '::test_each',
                    ),
                )),
            ('discovered.add_test', None, dict(
                suiteids=[relfileid2 + '::All',
                          relfileid2 + '::All::BasicTests'],
                test=TestInfo(
                    id=relfileid2 + '::All::BasicTests::test_first',
                    name='test_first',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid2,
                        func='All.BasicTests.test_first',
                        sub=None,
                        ),
                    source='{}:{}'.format(relfileid2, 32),
                    markers=None,
                    parentid=relfileid2 + '::All::BasicTests',
                    ),
                )),
            ('discovered.add_test', None, dict(
                suiteids=[relfileid2 + '::All',
                          relfileid2 + '::All::BasicTests'],
                test=TestInfo(
                    id=relfileid2 + '::All::BasicTests::test_each[1+2-3]',
                    name='test_each[1+2-3]',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid2,
                        func='All.BasicTests.test_each',
                        sub=['[1+2-3]'],
                        ),
                    source='{}:{}'.format(relfileid2, 63),
                    markers=['expected-failure', 'skip', 'skip-if'],
                    parentid=relfileid2 + '::All::BasicTests::test_each',
                    ),
                )),
            ])

    def test_finish(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile = 'x/y/z/test_eggs.py'.replace('/', os.path.sep)
        relfileid = os.path.join('.', relfile)
        session.items = [
            StubPytestItem(
                stub,
                nodeid=relfile + '::SpamTests::test_spam',
                name='test_spam',
                location=(relfile, 12, 'SpamTests.test_spam'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector(tests=discovered)

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                suiteids=[relfileid + '::SpamTests'],
                test=TestInfo(
                    id=relfileid + '::SpamTests::test_spam',
                    name='test_spam',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func='SpamTests.test_spam',
                        sub=None,
                        ),
                    source='{}:{}'.format(relfileid, 13),
                    markers=None,
                    parentid=relfileid + '::SpamTests',
                    ),
                )),
            ])

    def test_doctest(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = '/a/b/c'.replace('/', os.path.sep)
        doctestfile = 'x/test_doctest.txt'.replace('/', os.path.sep)
        doctestfileid = os.path.join('.', doctestfile)
        relfile = 'x/y/z/test_eggs.py'.replace('/', os.path.sep)
        relfileid = os.path.join('.', relfile)
        session.items = [
            StubPytestItem(
                stub,
                nodeid=doctestfile + '::test_doctest.txt',
                name='test_doctest.txt',
                location=(doctestfile, 0, '[doctest] test_doctest.txt'),
                fspath=os.path.join(testroot, doctestfile),
                kind='DoctestItem',
                ),
            # With --doctest-modules
            StubPytestItem(
                stub,
                nodeid=relfile + '::test_eggs',
                name='test_eggs',
                location=(relfile, 0, '[doctest] test_eggs'),
                fspath=os.path.join(testroot, relfile),
                kind='DoctestItem',
                ),
            StubPytestItem(
                stub,
                nodeid=relfile + '::test_eggs.TestSpam',
                name='test_eggs.TestSpam',
                location=(relfile, 12, '[doctest] test_eggs.TestSpam'),
                fspath=os.path.join(testroot, relfile),
                kind='DoctestItem',
                ),
            StubPytestItem(
                stub,
                nodeid=relfile + '::test_eggs.TestSpam.TestEggs',
                name='test_eggs.TestSpam.TestEggs',
                location=(relfile, 27, '[doctest] test_eggs.TestSpam.TestEggs'),
                fspath=os.path.join(testroot, relfile),
                kind='DoctestItem',
                ),
            ]
        collector = TestCollector(tests=discovered)

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                suiteids=[],
                test=TestInfo(
                    id=doctestfileid + '::test_doctest.txt',
                    name='test_doctest.txt',
                    path=TestPath(
                        root=testroot,
                        relfile=doctestfileid,
                        func=None,
                        ),
                    source='{}:{}'.format(doctestfileid, 1),
                    markers=[],
                    parentid=doctestfileid,
                    ),
                )),
            ('discovered.add_test', None, dict(
                suiteids=[],
                test=TestInfo(
                    id=relfileid + '::test_eggs',
                    name='test_eggs',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func=None,
                        ),
                    source='{}:{}'.format(relfileid, 1),
                    markers=[],
                    parentid=relfileid,
                    ),
                )),
            ('discovered.add_test', None, dict(
                suiteids=[],
                test=TestInfo(
                    id=relfileid + '::test_eggs.TestSpam',
                    name='test_eggs.TestSpam',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func=None,
                        ),
                    source='{}:{}'.format(relfileid, 13),
                    markers=[],
                    parentid=relfileid,
                    ),
                )),
            ('discovered.add_test', None, dict(
                suiteids=[],
                test=TestInfo(
                    id=relfileid + '::test_eggs.TestSpam.TestEggs',
                    name='test_eggs.TestSpam.TestEggs',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func=None,
                        ),
                    source='{}:{}'.format(relfileid, 28),
                    markers=[],
                    parentid=relfileid,
                    ),
                )),
            ])

    def test_nested_brackets(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile = 'x/y/z/test_eggs.py'.replace('/', os.path.sep)
        relfileid = os.path.join('.', relfile)
        session.items = [
            StubPytestItem(
                stub,
                nodeid=relfile + '::SpamTests::test_spam[a-[b]-c]',
                name='test_spam[a-[b]-c]',
                location=(relfile, 12, 'SpamTests.test_spam[a-[b]-c]'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector(tests=discovered)

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                suiteids=[relfileid + '::SpamTests'],
                test=TestInfo(
                    id=relfileid + '::SpamTests::test_spam[a-[b]-c]',
                    name='test_spam[a-[b]-c]',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func='SpamTests.test_spam',
                        sub=['[a-[b]-c]'],
                        ),
                    source='{}:{}'.format(relfileid, 13),
                    markers=None,
                    parentid=relfileid + '::SpamTests::test_spam',
                    ),
                )),
            ])

    def test_nested_suite(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile = 'x/y/z/test_eggs.py'.replace('/', os.path.sep)
        relfileid = os.path.join('.', relfile)
        session.items = [
            StubPytestItem(
                stub,
                nodeid=relfile + '::SpamTests::Ham::Eggs::test_spam',
                name='test_spam',
                location=(relfile, 12, 'SpamTests.Ham.Eggs.test_spam'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector(tests=discovered)

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                suiteids=[
                    relfileid + '::SpamTests',
                    relfileid + '::SpamTests::Ham',
                    relfileid + '::SpamTests::Ham::Eggs',
                    ],
                test=TestInfo(
                    id=relfileid + '::SpamTests::Ham::Eggs::test_spam',
                    name='test_spam',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func='SpamTests.Ham.Eggs.test_spam',
                        sub=None,
                        ),
                    source='{}:{}'.format(relfileid, 13),
                    markers=None,
                    parentid=relfileid + '::SpamTests::Ham::Eggs',
                    ),
                )),
            ])

    def test_windows(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = r'c:\a\b\c'
        relfile = r'X\Y\Z\test_eggs.py'
        session.items = [
            StubPytestItem(
                stub,
                nodeid='X/Y/Z/test_eggs.py::SpamTests::test_spam',
                name='test_spam',
                location=('x/y/z/test_eggs.py', 12, 'SpamTests.test_spam'),
                fspath=testroot + '\\' + relfile,
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector(tests=discovered)
        if os.name != 'nt':
            def normcase(path):
                path = path.lower()
                return path.replace('/', '\\')
            collector.NORMCASE = normcase
            collector.PATHSEP = '\\'

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                suiteids=[r'.\x\y\z\test_eggs.py::SpamTests'],
                test=TestInfo(
                    id=r'.\x\y\z\test_eggs.py::SpamTests::test_spam',
                    name='test_spam',
                    path=TestPath(
                        root=testroot,
                        relfile=r'.\x\y\z\test_eggs.py',
                        func='SpamTests.test_spam',
                        sub=None,
                        ),
                    source=r'.\x\y\z\test_eggs.py:{}'.format(13),
                    markers=None,
                    parentid=r'.\x\y\z\test_eggs.py::SpamTests',
                    ),
                )),
            ])

    def test_mysterious_parens(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile = 'x/y/z/test_eggs.py'.replace('/', os.path.sep)
        relfileid = os.path.join('.', relfile)
        session.items = [
            StubPytestItem(
                stub,
                nodeid=relfile + '::SpamTests::()::()::test_spam',
                name='test_spam',
                location=(relfile, 12, 'SpamTests.test_spam'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector(tests=discovered)

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                suiteids=[relfileid + '::SpamTests'],
                test=TestInfo(
                    id=relfileid + '::SpamTests::test_spam',
                    name='test_spam',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func='SpamTests.test_spam',
                        sub=[],
                        ),
                    source='{}:{}'.format(relfileid, 13),
                    markers=None,
                    parentid=relfileid + '::SpamTests',
                    ),
                )),
            ])

    def test_imported_test(self):
        # pytest will even discover tests that were imported from
        # another module!
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile = 'x/y/z/test_eggs.py'.replace('/', os.path.sep)
        relfileid = os.path.join('.', relfile)
        srcfile = 'x/y/z/_extern.py'.replace('/', os.path.sep)
        session.items = [
            StubPytestItem(
                stub,
                nodeid=relfile + '::SpamTests::test_spam',
                name='test_spam',
                location=(srcfile, 12, 'SpamTests.test_spam'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            StubPytestItem(
                stub,
                nodeid=relfile + '::test_ham',
                name='test_ham',
                location=(srcfile, 3, 'test_ham'),
                fspath=os.path.join(testroot, relfile),
                function=FakeFunc('test_spam'),
                ),
            ]
        collector = TestCollector(tests=discovered)

        collector.pytest_collection_finish(session)

        self.maxDiff = None
        self.assertEqual(stub.calls, [
            ('discovered.reset', None, None),
            ('discovered.add_test', None, dict(
                suiteids=[relfileid + '::SpamTests'],
                test=TestInfo(
                    id=relfileid + '::SpamTests::test_spam',
                    name='test_spam',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func='SpamTests.test_spam',
                        sub=None,
                        ),
                    source='{}:{}'.format(os.path.join('.', srcfile), 13),
                    markers=None,
                    parentid=relfileid + '::SpamTests',
                    ),
                )),
            ('discovered.add_test', None, dict(
                suiteids=[],
                test=TestInfo(
                    id=relfileid + '::test_ham',
                    name='test_ham',
                    path=TestPath(
                        root=testroot,
                        relfile=relfileid,
                        func='test_ham',
                        sub=None,
                        ),
                    source='{}:{}'.format(os.path.join('.', srcfile), 4),
                    markers=None,
                    parentid=relfileid,
                    ),
                )),
            ])


class DiscoveredTestsTests(unittest.TestCase):

    def test_list(self):
        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile = 'test_spam.py'
        relfileid = os.path.join('.', relfile)
        tests = [
            TestInfo(
                id=relfile + '::test_each[10-10]',
                name='test_each[10-10]',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='test_each',
                    sub=['[10-10]'],
                    ),
                source='{}:{}'.format(relfile, 10),
                markers=None,
                parentid=relfile + '::test_each',
                ),
            TestInfo(
                id=relfile + '::All::BasicTests::test_first',
                name='test_first',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='All.BasicTests.test_first',
                    sub=None,
                    ),
                source='{}:{}'.format(relfile, 62),
                markers=None,
                parentid=relfile + '::All::BasicTests',
                ),
            ]
        allsuiteids = [
            [],
            [relfile + '::All',
             relfile + '::All::BasicTests',
             ],
            ]
        expected = [test._replace(id=os.path.join('.', test.id),
                                  parentid=os.path.join('.', test.parentid))
                    for test in tests]
        discovered = DiscoveredTests()
        for test, suiteids in zip(tests, allsuiteids):
            discovered.add_test(test, suiteids)
        size = len(discovered)
        items = [discovered[0], discovered[1]]
        snapshot = list(discovered)

        self.maxDiff = None
        self.assertEqual(size, 2)
        self.assertEqual(items, expected)
        self.assertEqual(snapshot, expected)

    def test_reset(self):
        testroot = '/a/b/c'.replace('/', os.path.sep)
        discovered = DiscoveredTests()
        discovered.add_test(
            TestInfo(
                id='test_spam.py::test_each',
                name='test_each',
                path=TestPath(
                    root=testroot,
                    relfile='test_spam.py',
                    func='test_each',
                    ),
                source='{}:{}'.format('test_spam.py', 11),
                markers=[],
                parentid='test_spam.py',
                ),
            [])

        before = len(discovered), len(discovered.parents)
        discovered.reset()
        after = len(discovered), len(discovered.parents)

        self.assertEqual(before, (1, 2))
        self.assertEqual(after, (0, 0))

    def test_parents(self):
        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile = 'x/y/z/test_spam.py'.replace('/', os.path.sep)
        relfileid = os.path.join('.', relfile)
        tests = [
            TestInfo(
                id=relfile + '::test_each[10-10]',
                name='test_each[10-10]',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='test_each',
                    sub=['[10-10]'],
                    ),
                source='{}:{}'.format(relfile, 10),
                markers=None,
                parentid=relfile + '::test_each',
                ),
            TestInfo(
                id=relfile + '::All::BasicTests::test_first',
                name='test_first',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='All.BasicTests.test_first',
                    sub=None,
                    ),
                source='{}:{}'.format(relfile, 61),
                markers=None,
                parentid=relfile + '::All::BasicTests',
                ),
            ]
        allsuiteids = [
            [],
            [relfile + '::All',
             relfile + '::All::BasicTests',
             ],
            ]
        discovered = DiscoveredTests()
        for test, suiteids in zip(tests, allsuiteids):
            discovered.add_test(test, suiteids)

        parents = discovered.parents

        self.maxDiff = None
        self.assertEqual(parents, [
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot,
                ),
            ParentInfo(
                id='./x'.replace('/', os.path.sep),
                kind='folder',
                name='x',
                root=testroot,
                parentid='.',
                ),
            ParentInfo(
                id='./x/y'.replace('/', os.path.sep),
                kind='folder',
                name='y',
                root=testroot,
                parentid='./x'.replace('/', os.path.sep),
                ),
            ParentInfo(
                id='./x/y/z'.replace('/', os.path.sep),
                kind='folder',
                name='z',
                root=testroot,
                parentid='./x/y'.replace('/', os.path.sep),
                ),
            ParentInfo(
                id=relfileid,
                kind='file',
                name=os.path.basename(relfile),
                root=testroot,
                parentid=os.path.dirname(relfileid),
                ),
            ParentInfo(
                id=relfileid + '::All',
                kind='suite',
                name='All',
                root=testroot,
                parentid=relfileid,
                ),
            ParentInfo(
                id=relfileid + '::All::BasicTests',
                kind='suite',
                name='BasicTests',
                root=testroot,
                parentid=relfileid + '::All',
                ),
            ParentInfo(
                id=relfileid + '::test_each',
                kind='function',
                name='test_each',
                root=testroot,
                parentid=relfileid,
                ),
            ])

    def test_add_test_simple(self):
        testroot = '/a/b/c'.replace('/', os.path.sep)
        test = TestInfo(
            id='test_spam.py::test_spam',
            name='test_spam',
            path=TestPath(
                root=testroot,
                relfile='test_spam.py',
                func='test_spam',
                ),
            source='{}:{}'.format('test_spam.py', 11),
            markers=[],
            parentid='test_spam.py',
            )
        expected = test._replace(id=os.path.join('.', test.id),
                                 parentid=os.path.join('.', test.parentid))
        discovered = DiscoveredTests()

        before = list(discovered), discovered.parents
        discovered.add_test(test, [])
        after = list(discovered), discovered.parents

        self.maxDiff = None
        self.assertEqual(before, ([], []))
        self.assertEqual(after, ([expected], [
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot,
                ),
            ParentInfo(
                id=os.path.join('.', 'test_spam.py'),
                kind='file',
                name='test_spam.py',
                root=testroot,
                parentid='.',
                ),
            ]))

    def test_multiroot(self):
        # the first root
        testroot1 = '/a/b/c'.replace('/', os.path.sep)
        relfile1 = 'test_spam.py'
        relfileid1 = os.path.join('.', relfile1)
        alltests = [
            TestInfo(
                id=relfile1 + '::test_spam',
                name='test_spam',
                path=TestPath(
                    root=testroot1,
                    relfile=relfile1,
                    func='test_spam',
                    ),
                source='{}:{}'.format(relfile1, 10),
                markers=[],
                parentid=relfile1,
                ),
            ]
        allsuiteids = [
            [],
            ]
        # the second root
        testroot2 = '/x/y/z'.replace('/', os.path.sep)
        relfile2 = 'w/test_eggs.py'
        relfileid2 = os.path.join('.', relfile2)
        alltests.extend([
            TestInfo(
                id=relfile2 + 'BasicTests::test_first',
                name='test_first',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile2,
                    func='BasicTests.test_first',
                    ),
                source='{}:{}'.format(relfile2, 61),
                markers=[],
                parentid=relfile2 + '::BasicTests',
                ),
            ])
        allsuiteids.extend([
            [relfile2 + '::BasicTests',
             ],
            ])

        discovered = DiscoveredTests()
        for test, suiteids in zip(alltests, allsuiteids):
            discovered.add_test(test, suiteids)
        tests = list(discovered)
        parents = discovered.parents

        self.maxDiff = None
        self.assertEqual(tests, [
            # the first root
            TestInfo(
                id=relfileid1 + '::test_spam',
                name='test_spam',
                path=TestPath(
                    root=testroot1,
                    relfile=relfile1,
                    func='test_spam',
                    ),
                source='{}:{}'.format(relfile1, 10),
                markers=[],
                parentid=relfileid1,
                ),
            # the secondroot
            TestInfo(
                id=relfileid2 + 'BasicTests::test_first',
                name='test_first',
                path=TestPath(
                    root=testroot2,
                    relfile=relfile2,
                    func='BasicTests.test_first',
                    ),
                source='{}:{}'.format(relfile2, 61),
                markers=[],
                parentid=relfileid2 + '::BasicTests',
                ),
            ])
        self.assertEqual(parents, [
            # the first root
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot1,
                ),
            ParentInfo(
                id=relfileid1,
                kind='file',
                name=os.path.basename(relfile1),
                root=testroot1,
                parentid=os.path.dirname(relfileid1),
                ),
            # the secondroot
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot2,
                ),
            ParentInfo(
                id='./w'.replace('/', os.path.sep),
                kind='folder',
                name='w',
                root=testroot2,
                parentid='.',
                ),
            ParentInfo(
                id=relfileid2,
                kind='file',
                name=os.path.basename(relfile2),
                root=testroot2,
                parentid=os.path.dirname(relfileid2),
                ),
            ParentInfo(
                id=relfileid2 + '::BasicTests',
                kind='suite',
                name='BasicTests',
                root=testroot2,
                parentid=relfileid2,
                ),
            ])

    def test_doctest(self):
        stub = Stub()
        testroot = '/a/b/c'.replace('/', os.path.sep)
        doctestfile = './x/test_doctest.txt'.replace('/', os.path.sep)
        relfile = './x/y/z/test_eggs.py'.replace('/', os.path.sep)
        alltests = [
            TestInfo(
                id=doctestfile + '::test_doctest.txt',
                name='test_doctest.txt',
                path=TestPath(
                    root=testroot,
                    relfile=doctestfile,
                    func=None,
                    ),
                source='{}:{}'.format(doctestfile, 0),
                markers=[],
                parentid=doctestfile,
                ),
            # With --doctest-modules
            TestInfo(
                id=relfile + '::test_eggs',
                name='test_eggs',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func=None,
                    ),
                source='{}:{}'.format(relfile, 0),
                markers=[],
                parentid=relfile,
                ),
            TestInfo(
                id=relfile + '::test_eggs.TestSpam',
                name='test_eggs.TestSpam',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func=None,
                    ),
                source='{}:{}'.format(relfile, 12),
                markers=[],
                parentid=relfile,
                ),
            TestInfo(
                id=relfile + '::test_eggs.TestSpam.TestEggs',
                name='test_eggs.TestSpam.TestEggs',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func=None,
                    ),
                source='{}:{}'.format(relfile, 27),
                markers=[],
                parentid=relfile,
                ),
            ]
        discovered = DiscoveredTests()

        for test in alltests:
            discovered.add_test(test, [])
        tests = list(discovered)
        parents = discovered.parents

        self.maxDiff = None
        self.assertEqual(tests, alltests)
        self.assertEqual(parents, [
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot,
                ),
            ParentInfo(
                id='./x'.replace('/', os.path.sep),
                kind='folder',
                name='x',
                root=testroot,
                parentid='.',
                ),
            ParentInfo(
                id=doctestfile,
                kind='file',
                name=os.path.basename(doctestfile),
                root=testroot,
                parentid=os.path.dirname(doctestfile),
                ),
            ParentInfo(
                id='./x/y'.replace('/', os.path.sep),
                kind='folder',
                name='y',
                root=testroot,
                parentid='./x'.replace('/', os.path.sep),
                ),
            ParentInfo(
                id='./x/y/z'.replace('/', os.path.sep),
                kind='folder',
                name='z',
                root=testroot,
                parentid='./x/y'.replace('/', os.path.sep),
                ),
            ParentInfo(
                id=relfile,
                kind='file',
                name=os.path.basename(relfile),
                root=testroot,
                parentid=os.path.dirname(relfile),
                ),
            ])

    def test_nested_suite_simple(self):
        stub = Stub()
        discovered = StubDiscoveredTests(stub)
        session = StubPytestSession(stub)
        testroot = '/a/b/c'.replace('/', os.path.sep)
        relfile = './test_eggs.py'.replace('/', os.path.sep)
        alltests = [
            TestInfo(
                id=relfile + '::TestOuter::TestInner::test_spam',
                name='test_spam',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='TestOuter.TestInner.test_spam',
                    ),
                source='{}:{}'.format(relfile, 10),
                markers=None,
                parentid=relfile + '::TestOuter::TestInner',
                ),
            TestInfo(
                id=relfile + '::TestOuter::TestInner::test_eggs',
                name='test_eggs',
                path=TestPath(
                    root=testroot,
                    relfile=relfile,
                    func='TestOuter.TestInner.test_eggs',
                    ),
                source='{}:{}'.format(relfile, 21),
                markers=None,
                parentid=relfile + '::TestOuter::TestInner',
                ),
            ]
        allsuiteids = [
            [relfile + '::TestOuter',
             relfile + '::TestOuter::TestInner',
             ],
            [relfile + '::TestOuter',
             relfile + '::TestOuter::TestInner',
             ],
            ]

        discovered = DiscoveredTests()
        for test, suiteids in zip(alltests, allsuiteids):
            discovered.add_test(test, suiteids)
        tests = list(discovered)
        parents = discovered.parents

        self.maxDiff = None
        self.assertEqual(tests, alltests)
        self.assertEqual(parents, [
            ParentInfo(
                id='.',
                kind='folder',
                name=testroot,
                ),
            ParentInfo(
                id=relfile,
                kind='file',
                name=os.path.basename(relfile),
                root=testroot,
                parentid=os.path.dirname(relfile),
                ),
            ParentInfo(
                id=relfile + '::TestOuter',
                kind='suite',
                name='TestOuter',
                root=testroot,
                parentid=relfile,
                ),
            ParentInfo(
                id=relfile + '::TestOuter::TestInner',
                kind='suite',
                name='TestInner',
                root=testroot,
                parentid=relfile + '::TestOuter',
                ),
            ])
