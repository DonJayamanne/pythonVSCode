import sys as VC_sys
import locale as VC_locale

VC_IS_PY2 = VC_sys.version_info < (3,)

# SafeRepr based on the pydevd implementation
# https://github.com/microsoft/ptvsd/blob/master/src/ptvsd/_vendored/pydevd/_pydevd_bundle/pydevd_safe_repr.py
class VC_SafeRepr(object):
    # Py3 compat - alias unicode to str, and xrange to range
    try:
        unicode  # noqa
    except NameError:
        unicode = str
    try:
        xrange  # noqa
    except NameError:
        xrange = range

    # Can be used to override the encoding from locale.getpreferredencoding()
    locale_preferred_encoding = None

    # Can be used to override the encoding used for sys.stdout.encoding
    sys_stdout_encoding = None

    # String types are truncated to maxstring_outer when at the outer-
    # most level, and truncated to maxstring_inner characters inside
    # collections.
    maxstring_outer = 2 ** 16
    maxstring_inner = 30
    if not VC_IS_PY2:
        string_types = (str, bytes)
        set_info = (set, '{', '}', False)
        frozenset_info = (frozenset, 'frozenset({', '})', False)
        int_types = (int,)
        long_iter_types = (list, tuple, bytearray, range,
                           dict, set, frozenset)
    else:
        string_types = (str, unicode)
        set_info = (set, 'set([', '])', False)
        frozenset_info = (frozenset, 'frozenset([', '])', False)
        int_types = (int, long)  # noqa
        long_iter_types = (list, tuple, bytearray, xrange,
                           dict, set, frozenset, buffer)  # noqa

    # Collection types are recursively iterated for each limit in
    # maxcollection.
    maxcollection = (15, 10)

    # Specifies type, prefix string, suffix string, and whether to include a
    # comma if there is only one element. (Using a sequence rather than a
    # mapping because we use isinstance() to determine the matching type.)
    collection_types = [
        (tuple, '(', ')', True),
        (list, '[', ']', False),
        frozenset_info,
        set_info,
    ]
    try:
        from collections import deque
        collection_types.append((deque, 'deque([', '])', False))
    except Exception:
        pass

    # type, prefix string, suffix string, item prefix string,
    # item key/value separator, item suffix string
    dict_types = [(dict, '{', '}', '', ': ', '')]
    try:
        from collections import OrderedDict
        dict_types.append((OrderedDict, 'OrderedDict([', '])', '(', ', ', ')'))
    except Exception:
        pass

    # All other types are treated identically to strings, but using
    # different limits.
    maxother_outer = 2 ** 16
    maxother_inner = 30

    convert_to_hex = False
    raw_value = False

    def __call__(self, obj):
        try:
            if VC_IS_PY2:
                return ''.join((x.encode('utf-8') if isinstance(x, unicode) else x) for x in self._repr(obj, 0))
            else:
                return ''.join(self._repr(obj, 0))
        except Exception:
            try:
                return 'An exception was raised: %r' % sys.exc_info()[1]
            except Exception:
                return 'An exception was raised'

    def _repr(self, obj, level):
        '''Returns an iterable of the parts in the final repr string.'''

        try:
            obj_repr = type(obj).__repr__
        except Exception:
            obj_repr = None

        def has_obj_repr(t):
            r = t.__repr__
            try:
                return obj_repr == r
            except Exception:
                return obj_repr is r

        for t, prefix, suffix, comma in self.collection_types:
            if isinstance(obj, t) and has_obj_repr(t):
                return self._repr_iter(obj, level, prefix, suffix, comma)

        for t, prefix, suffix, item_prefix, item_sep, item_suffix in self.dict_types:  # noqa
            if isinstance(obj, t) and has_obj_repr(t):
                return self._repr_dict(obj, level, prefix, suffix,
                                       item_prefix, item_sep, item_suffix)

        for t in self.string_types:
            if isinstance(obj, t) and has_obj_repr(t):
                return self._repr_str(obj, level)

        if self._is_long_iter(obj):
            return self._repr_long_iter(obj)

        return self._repr_other(obj, level)

    # Determines whether an iterable exceeds the limits set in
    # maxlimits, and is therefore unsafe to repr().
    def _is_long_iter(self, obj, level=0):
        try:
            # Strings have their own limits (and do not nest). Because
            # they don't have __iter__ in 2.x, this check goes before
            # the next one.
            if isinstance(obj, self.string_types):
                return len(obj) > self.maxstring_inner

            # If it's not an iterable (and not a string), it's fine.
            if not hasattr(obj, '__iter__'):
                return False

            # If it's not an instance of these collection types then it
            # is fine. Note: this is a fix for
            # https://github.com/Microsoft/ptvsd/issues/406
            if not isinstance(obj, self.long_iter_types):
                return False

            # Iterable is its own iterator - this is a one-off iterable
            # like generator or enumerate(). We can't really count that,
            # but repr() for these should not include any elements anyway,
            # so we can treat it the same as non-iterables.
            if obj is iter(obj):
                return False

            # xrange reprs fine regardless of length.
            if isinstance(obj, xrange):
                return False

            # numpy and scipy collections (ndarray etc) have
            # self-truncating repr, so they're always safe.
            try:
                module = type(obj).__module__.partition('.')[0]
                if module in ('numpy', 'scipy'):
                    return False
            except Exception:
                pass

            # Iterables that nest too deep are considered long.
            if level >= len(self.maxcollection):
                return True

            # It is too long if the length exceeds the limit, or any
            # of its elements are long iterables.
            if hasattr(obj, '__len__'):
                try:
                    size = len(obj)
                except Exception:
                    size = None
                if size is not None and size > self.maxcollection[level]:
                    return True
                return any((self._is_long_iter(item, level + 1) for item in obj))  # noqa
            return any(i > self.maxcollection[level] or self._is_long_iter(item, level + 1) for i, item in enumerate(obj))  # noqa

        except Exception:
            # If anything breaks, assume the worst case.
            return True

    def _repr_iter(self, obj, level, prefix, suffix,
                   comma_after_single_element=False):
        yield prefix

        if level >= len(self.maxcollection):
            yield '...'
        else:
            count = self.maxcollection[level]
            yield_comma = False
            for item in obj:
                if yield_comma:
                    yield ', '
                yield_comma = True

                count -= 1
                if count <= 0:
                    yield '...'
                    break

                for p in self._repr(item, 100 if item is obj else level + 1):
                    yield p
            else:
                if comma_after_single_element:
                    if count == self.maxcollection[level] - 1:
                        yield ','
        yield suffix

    def _repr_long_iter(self, obj):
        try:
            length = hex(len(obj)) if self.convert_to_hex else len(obj)
            obj_repr = '<%s, len() = %s>' % (type(obj).__name__, length)
        except Exception:
            try:
                obj_repr = '<' + type(obj).__name__ + '>'
            except Exception:
                obj_repr = '<no repr available for object>'
        yield obj_repr

    def _repr_dict(self, obj, level, prefix, suffix,
                   item_prefix, item_sep, item_suffix):
        if not obj:
            yield prefix + suffix
            return
        if level >= len(self.maxcollection):
            yield prefix + '...' + suffix
            return

        yield prefix

        count = self.maxcollection[level]
        yield_comma = False

        try:
            sorted_keys = sorted(obj)
        except Exception:
            sorted_keys = list(obj)

        for key in sorted_keys:
            if yield_comma:
                yield ', '
            yield_comma = True

            count -= 1
            if count <= 0:
                yield '...'
                break

            yield item_prefix
            for p in self._repr(key, level + 1):
                yield p

            yield item_sep

            try:
                item = obj[key]
            except Exception:
                yield '<?>'
            else:
                for p in self._repr(item, 100 if item is obj else level + 1):
                    yield p
            yield item_suffix

        yield suffix

    def _repr_str(self, obj, level):
        return self._repr_obj(obj, level,
                              self.maxstring_inner, self.maxstring_outer)

    def _repr_other(self, obj, level):
        return self._repr_obj(obj, level,
                              self.maxother_inner, self.maxother_outer)

    def _repr_obj(self, obj, level, limit_inner, limit_outer):
        try:
            if self.raw_value:
                # For raw value retrieval, ignore all limits.
                if isinstance(obj, bytes):
                    yield obj.decode('latin-1')
                    return

                try:
                    mv = memoryview(obj)
                except Exception:
                    yield self._convert_to_unicode_or_bytes_repr(repr(obj))
                    return
                else:
                    # Map bytes to Unicode codepoints with same values.
                    yield mv.tobytes().decode('latin-1')
                    return
            elif self.convert_to_hex and isinstance(obj, self.int_types):
                obj_repr = hex(obj)
            else:
                obj_repr = repr(obj)
        except Exception:
            try:
                obj_repr = object.__repr__(obj)
            except Exception:
                try:
                    obj_repr = '<no repr available for ' + type(obj).__name__ + '>'  # noqa
                except Exception:
                    obj_repr = '<no repr available for object>'

        limit = limit_inner if level > 0 else limit_outer

        if limit >= len(obj_repr):
            yield self._convert_to_unicode_or_bytes_repr(obj_repr)
            return

        # Slightly imprecise calculations - we may end up with a string that is
        # up to 3 characters longer than limit. If you need precise formatting,
        # you are using the wrong class.
        left_count, right_count = max(1, int(2 * limit / 3)), max(1, int(limit / 3))  # noqa

        if VC_IS_PY2 and isinstance(obj_repr, bytes):
            # If we can convert to unicode before slicing, that's better (but don't do
            # it if it's not possible as we may be dealing with actual binary data).

            obj_repr = self._bytes_as_unicode_if_possible(obj_repr)
            if isinstance(obj_repr, unicode):
                # Deal with high-surrogate leftovers on Python 2.
                try:
                    if left_count > 0 and unichr(0xD800) <= obj_repr[left_count - 1] <= unichr(0xDBFF):
                        left_count -= 1
                except ValueError:
                    # On Jython unichr(0xD800) will throw an error:
                    # ValueError: unichr() arg is a lone surrogate in range (0xD800, 0xDFFF) (Jython UTF-16 encoding)
                    # Just ignore it in this case.
                    pass

                start = obj_repr[:left_count]

                # Note: yielding unicode is fine (it'll be properly converted to utf-8 if needed).
                yield start
                yield '...'

                # Deal with high-surrogate leftovers on Python 2.
                try:
                    if right_count > 0 and unichr(0xD800) <= obj_repr[-right_count - 1] <= unichr(0xDBFF):
                        right_count -= 1
                except ValueError:
                    # On Jython unichr(0xD800) will throw an error:
                    # ValueError: unichr() arg is a lone surrogate in range (0xD800, 0xDFFF) (Jython UTF-16 encoding)
                    # Just ignore it in this case.
                    pass

                yield obj_repr[-right_count:]
                return
            else:
                # We can't decode it (binary string). Use repr() of bytes.
                obj_repr = repr(obj_repr)

        yield obj_repr[:left_count]
        yield '...'
        yield obj_repr[-right_count:]

    def _convert_to_unicode_or_bytes_repr(self, obj_repr):
        if VC_IS_PY2 and isinstance(obj_repr, bytes):
            obj_repr = self._bytes_as_unicode_if_possible(obj_repr)
            if isinstance(obj_repr, bytes):
                # If we haven't been able to decode it this means it's some binary data
                # we can't make sense of, so, we need its repr() -- otherwise json
                # encoding may break later on.
                obj_repr = repr(obj_repr)
        return obj_repr

    def _bytes_as_unicode_if_possible(self, obj_repr):
        # We try to decode with 3 possible encoding (sys.stdout.encoding,
        # locale.getpreferredencoding() and 'utf-8). If no encoding can decode
        # the input, we return the original bytes.
        try_encodings = []
        encoding = self.sys_stdout_encoding or getattr(sys.stdout, 'encoding', '')
        if encoding:
            try_encodings.append(encoding.lower())

        preferred_encoding = self.locale_preferred_encoding or VC_locale.getpreferredencoding()
        if preferred_encoding:
            preferred_encoding = preferred_encoding.lower()
            if preferred_encoding not in try_encodings:
                try_encodings.append(preferred_encoding)

        if 'utf-8' not in try_encodings:
            try_encodings.append('utf-8')

        for encoding in try_encodings:
            try:
                return obj_repr.decode(encoding)
            except UnicodeDecodeError:
                pass

        return obj_repr  # Return the original version (in bytes)


# Query Jupyter server for the value of a variable
import json as _VSCODE_json
_VSCODE_max_len = 200
# In IJupyterVariables.getValue this '_VSCode_JupyterTestValue' will be replaced with the json stringified value of the target variable
# Indexes off of _VSCODE_targetVariable need to index types that are part of IJupyterVariable
_VSCODE_targetVariable = _VSCODE_json.loads('_VSCode_JupyterTestValue')

_VSCODE_evalResult = eval(_VSCODE_targetVariable['name'])

# Find shape and count if available
if (hasattr(_VSCODE_evalResult, 'shape')):
    try:
        # Get a bit more restrictive with exactly what we want to count as a shape, since anything can define it
        if isinstance(_VSCODE_evalResult.shape, tuple):
            _VSCODE_shapeStr = str(_VSCODE_evalResult.shape)
            if len(_VSCODE_shapeStr) >= 3 and _VSCODE_shapeStr[0] == '(' and _VSCODE_shapeStr[-1] == ')' and ',' in _VSCODE_shapeStr:
                _VSCODE_targetVariable['shape'] = _VSCODE_shapeStr
            del _VSCODE_shapeStr
    except TypeError:
        pass

if (hasattr(_VSCODE_evalResult, '__len__')):
    try:
        _VSCODE_targetVariable['count'] = len(_VSCODE_evalResult)
    except TypeError:
        pass

# Use SafeRepr to get our short string value
VC_sr = VC_SafeRepr()
_VSCODE_targetVariable['value'] = VC_sr(_VSCODE_evalResult)

print(_VSCODE_json.dumps(_VSCODE_targetVariable))

del VC_locale
del VC_IS_PY2
del VC_sys
del VC_SafeRepr
del VC_sr
