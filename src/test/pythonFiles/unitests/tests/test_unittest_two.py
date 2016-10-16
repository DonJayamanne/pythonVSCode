import unittest

class Test_test2(unittest.TestCase):
    def test_A2(self):
        self.fail("Not implemented")

    def test_B2(self):
        self.assertEqual(1,1,'Not equal')

class Test_test2a(unittest.TestCase):
    def test_222A2(self):
        self.fail("Not implemented")

    def test_222B2(self):
        self.assertEqual(1,1,'Not equal')

    class Test_test2a1(unittest.TestCase):
        def test_222A2wow(self):
            self.fail("Not implemented")

        def test_222B2wow(self):
            self.assertEqual(1,1,'Not equal')

if __name__ == '__main__':
    unittest.main()
