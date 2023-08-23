# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
import unittest

import pytest


@pytest.mark.parametrize("num", range(0, 2000))
def test_odd_even(num):
    # assert num % 2 == 0
    assert True


class NumbersTest(unittest.TestCase):
    def test_even(self):
        for i in range(0, 200):
            with self.subTest(i=i):
                # self.assertEqual(i % 2, 0)
                assert True
