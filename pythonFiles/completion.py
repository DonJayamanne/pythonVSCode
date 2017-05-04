import os
import io
import re
import sys
import json
import traceback

WORD_RE = re.compile(r'\w')
jediPreview = False


class JediCompletion(object):
    basic_types = {
        'module': 'import',
        'instance': 'variable',
        'statement': 'value',
        'param': 'variable',
    }

    def __init__(self):
        self.default_sys_path = sys.path
        self._input = io.open(sys.stdin.fileno(), encoding='utf-8')

    def _get_definition_type(self, definition):
        is_built_in = definition.in_builtin_module
        # if definition.type not in ['import', 'keyword'] and is_built_in():
        #    return 'builtin'
        try:
            if definition.type in ['statement'] and definition.name.isupper():
                return 'constant'
            return self.basic_types.get(definition.type, definition.type)
        except Exception:
            return 'builtin'

    def _additional_info(self, completion):
        """Provide additional information about the completion object."""
        if not hasattr(completion, '_definition') or completion._definition is None:
            return ''
        if completion.type == 'statement':
            nodes_to_display = ['InstanceElement', 'String', 'Node', 'Lambda',
                                'Number']
            return ''.join(c.get_code() for c in
                           completion._definition.children if type(c).__name__
                           in nodes_to_display).replace('\n', '')
        return ''

    @classmethod
    def _get_top_level_module(cls, path):
        """Recursively walk through directories looking for top level module.

        Jedi will use current filepath to look for another modules at same
        path, but it will not be able to see modules **above**, so our goal
        is to find the higher python module available from filepath.
        """
        _path, _ = os.path.split(path)
        if os.path.isfile(os.path.join(_path, '__init__.py')):
            return cls._get_top_level_module(_path)
        return path

    def _generate_signature(self, completion):
        """Generate signature with function arguments.
        """
        if completion.type in ['module'] or not hasattr(completion, 'params'):
            return ''
        return '%s(%s)' % (
            completion.name,
            ', '.join(p.description for p in completion.params if p))

    def _get_call_signatures(self, script):
        """Extract call signatures from jedi.api.Script object in failsafe way.

        Returns:
            Tuple with original signature object, name and value.
        """
        _signatures = []
        try:
            call_signatures = script.call_signatures()
        except KeyError:
            call_signatures = []
        for signature in call_signatures:
            for pos, param in enumerate(signature.params):
                if not param.name:
                    continue
                if param.name == 'self' and pos == 0:
                    continue
                if WORD_RE.match(param.name) is None:
                    continue
                try:
                    name, value = param.description.split('=')
                except ValueError:
                    name = param.description
                    value = None
                if name.startswith('*'):
                    continue
                _signatures.append((signature, name, value))
        return _signatures

    def _get_call_signatures_with_args(self, script):
        """Extract call signatures from jedi.api.Script object in failsafe way.

        Returns:
            Array with dictionary
        """
        _signatures = []
        try:
            call_signatures = script.call_signatures()
        except KeyError:
            call_signatures = []
        for signature in call_signatures:
            sig = {"name": "", "description": "", "docstring": "",
                   "paramindex": 0, "params": [], "bracketstart": []}
            sig["description"] = signature.description
            try:
                sig["docstring"] = signature.docstring()
                sig["raw_docstring"] = signature.docstring(raw=True)
            except Exception:
                sig["docstring"] = ''
                sig["raw_docstring"] = ''
                
            sig["name"] = signature.name
            sig["paramindex"] = signature.index
            sig["bracketstart"].append(signature.index)

            _signatures.append(sig)
            for pos, param in enumerate(signature.params):
                if not param.name:
                    continue
                if param.name == 'self' and pos == 0:
                    continue
                if WORD_RE.match(param.name) is None:
                    continue
                try:
                    name, value = param.description.split('=')
                except ValueError:
                    name = param.description
                    value = None
                # if name.startswith('*'):
                #    continue
                #_signatures.append((signature, name, value))
                paramDocstring = ''
                try:
                    paramDocstring = param.docstring()
                except Exception:
                    paramDocstring = ''

                sig["params"].append({"name": name, "value": value, "docstring": paramDocstring, "description": param.description})
        return _signatures

    def _serialize_completions(self, script, identifier=None, prefix=''):
        """Serialize response to be read from VSCode.

        Args:
            script: Instance of jedi.api.Script object.
            identifier: Unique completion identifier to pass back to VSCode.
            prefix: String with prefix to filter function arguments.
                Used only when fuzzy matcher turned off.

        Returns:
            Serialized string to send to VSCode.
        """
        _completions = []

        for signature, name, value in self._get_call_signatures(script):
            if not self.fuzzy_matcher and not name.lower().startswith(
                    prefix.lower()):
                continue
            _completion = {
                'type': 'property',
                'raw_type': '',
                'rightLabel': self._additional_info(signature)
            }
            _completion['description'] = ''
            _completion['raw_docstring'] = ''
            
            # we pass 'text' here only for fuzzy matcher
            if value:
                _completion['snippet'] = '%s=${1:%s}$0' % (name, value)
                _completion['text'] = '%s=%s' % (name, value)
            else:
                _completion['snippet'] = '%s=$1$0' % name
                _completion['text'] = name
                _completion['displayText'] = name
            if self.show_doc_strings:
                try:
                    _completion['description'] = signature.docstring()
                    _completion['raw_docstring'] = signature.docstring(raw=True)
                except Exception:
                    _completion['description'] = ''
                    _completion['raw_docstring'] = ''
            else:
                _completion['description'] = self._generate_signature(
                    signature)
            _completions.append(_completion)

        try:
            completions = script.completions()
        except KeyError:
            completions = []
        for completion in completions:
            if self.show_doc_strings:
                try:
                    description = completion.docstring()
                except Exception:
                    description = ''
            else:
                description = self._generate_signature(completion)

            try:
                rawDocstring = completion.docstring(raw=True)
                _completion = {
                    'text': completion.name,
                    'type': self._get_definition_type(completion),
                    'raw_type': completion.type,
                    'description': description,
                    'raw_docstring': rawDocstring,
                    'rightLabel': self._additional_info(completion)
                }                
            except Exception:
                continue

            for c in _completions:
                if c['text'] == _completion['text']:
                    c['type'] = _completion['type']
                    c['raw_type'] = _completion['raw_type']
                    if len(c['description']) == 0 and len(c['raw_docstring']) == 0:
                        c['description'] = _completion['description']
                        c['raw_docstring'] = _completion['description']
                    
            
            if any([c['text'].split('=')[0] == _completion['text']
                    for c in _completions]):
                # ignore function arguments we already have
                continue
            _completions.append(_completion)
        return json.dumps({'id': identifier, 'results': _completions})

    def _serialize_methods(self, script, identifier=None, prefix=''):
        _methods = []
        try:
            completions = script.completions()
        except KeyError:
            return []

        for completion in completions:
            if completion.name == '__autocomplete_python':
              instance = completion.parent().name
              break
        else:
            instance = 'self.__class__'

        for completion in completions:
            params = []
            if hasattr(completion, 'params'):
                params = [p.description for p in completion.params
                          if ARGUMENT_RE.match(p.description)]
            if completion.parent().type == 'class':
              _methods.append({
                'parent': completion.parent().name,
                'instance': instance,
                'name': completion.name,
                'params': params,
                'moduleName': completion.module_name,
                'fileName': completion.module_path,
                'line': completion.line,
                'column': completion.column,
              })
        return json.dumps({'id': identifier, 'results': _methods})

    def _serialize_arguments(self, script, identifier=None):
        """Serialize response to be read from VSCode.

        Args:
            script: Instance of jedi.api.Script object.
            identifier: Unique completion identifier to pass back to VSCode.

        Returns:
            Serialized string to send to VSCode.
        """
        return json.dumps({"id": identifier, "results": self._get_call_signatures_with_args(script)})

    def _top_definition(self, definition):
        for d in definition.goto_assignments():
            if d == definition:
                continue
            if d.type == 'import':
                return self._top_definition(d)
            else:
                return d
        return definition

    def _extract_range(self, definition):
        """Provides the definition range of a given definition

        For regular symbols it returns the start and end location of the
        characters making up the symbol.

        For scoped containers it will return the entire definition of the
        scope.

        The scope that jedi provides ends with the first character of the next
        scope so it's not ideal. For vscode we need the scope to end with the
        last character of actual code. That's why we extract the lines that
        make up our scope and trim the trailing whitespace.
        """
        from jedi import common
        from jedi.parser.utils import load_parser
        # get the scope range
        try:
            if definition.type in ['class', 'function'] and hasattr(definition, '_definition'):
                scope = definition._definition
                start_line = scope.start_pos[0] - 1
                start_column = scope.start_pos[1]
                end_line = scope.end_pos[0] - 1
                end_column = scope.end_pos[1]
                # get the lines
                path = definition._definition.get_parent_until().path
                parser = load_parser(path)
                lines = common.splitlines(parser.source)
                lines[end_line] = lines[end_line][:end_column]
                # trim the lines
                lines = lines[start_line:end_line + 1]
                lines = '\n'.join(lines).rstrip().split('\n')
                end_line = start_line + len(lines) - 1
                end_column = len(lines[-1]) - 1
            else:
                symbol = definition._name
                start_line = symbol.start_pos[0] - 1
                start_column = symbol.start_pos[1]
                end_line = symbol.end_pos[0] - 1
                end_column =  symbol.end_pos[1]
            return {
                'start_line': start_line,
                'start_column': start_column,
                'end_line': end_line,
                'end_column': end_column
            }
        except Exception as e:
            return {
                'start_line': definition.line - 1,
                'start_column': definition.column, 
                'end_line': definition.line - 1,
                'end_column': definition.column
            }
    def _get_definitionsx(self, definitions, identifier=None, ignoreNoModulePath=False):
        """Serialize response to be read from VSCode.

        Args:
            definitions: List of jedi.api.classes.Definition objects.
            identifier: Unique completion identifier to pass back to VSCode.

        Returns:
            Serialized string to send to VSCode.
        """
        _definitions = []
        for definition in definitions:
            try:
                if definition.type == 'import':
                    definition = self._top_definition(definition)
                definitionRange = {
                    'start_line': 0,
                    'start_column': 0, 
                    'end_line': 0,
                    'end_column': 0
                }
                module_path = ''
                if hasattr(definition, 'module_path') and definition.module_path:
                    module_path = definition.module_path
                    definitionRange = self._extract_range(definition)
                else:
                    if not ignoreNoModulePath:
                        continue
                try:
                    parent = definition.parent()
                    container = parent.name if parent.type != 'module' else ''
                except Exception:
                    container = ''
                
                try:
                    docstring = definition.docstring()
                    rawdocstring = definition.docstring(raw=True)
                except Exception:
                    docstring = ''
                    rawdocstring = ''
                _definition = {
                    'text': definition.name,
                    'type': self._get_definition_type(definition),
                    'raw_type': definition.type,
                    'fileName': module_path,
                    'container': container,
                    'range': definitionRange,
                    'description': definition.description,
                    'docstring': docstring,
                    'raw_docstring': rawdocstring,
                    'signature': self._generate_signature(definition)
                }
                _definitions.append(_definition)
            except Exception as e:
                pass
        return _definitions

    def _serialize_definitions(self, definitions, identifier=None):
        """Serialize response to be read from VSCode.

        Args:
            definitions: List of jedi.api.classes.Definition objects.
            identifier: Unique completion identifier to pass back to VSCode.

        Returns:
            Serialized string to send to VSCode.
        """
        _definitions = []
        for definition in definitions:
            try:
                if definition.module_path:
                    if definition.type == 'import':
                        definition = self._top_definition(definition)
                    if not definition.module_path:
                        continue
                    try:
                        parent = definition.parent()
                        container = parent.name if parent.type != 'module' else ''
                    except Exception:
                        container = ''
                
                    try:
                        docstring = definition.docstring()
                        rawdocstring = definition.docstring(raw=True)
                    except Exception:
                        docstring = ''
                        rawdocstring = ''
                    _definition = {
                        'text': definition.name,
                        'type': self._get_definition_type(definition),
                        'raw_type': definition.type,
                        'fileName': definition.module_path,
                        'container': container,
                        'range': self._extract_range(definition),
                        'description': definition.description,
                        'docstring': docstring,
                        'raw_docstring': rawdocstring
                    }
                    _definitions.append(_definition)
            except Exception as e:
                pass
        return json.dumps({'id': identifier, 'results': _definitions})

    def _serialize_tooltip(self, definitions, identifier=None):
        _definitions = []
        for definition in definitions:
            signature = definition.name
            description = None
            if definition.type in ['class', 'function']:
                signature = self._generate_signature(definition)
                try:
                    description = definition.docstring(raw=True).strip()
                except Exception:
                    description = ''
                if not description and not hasattr(definition, 'get_line_code'):
                    # jedi returns an empty string for compiled objects
                    description = definition.docstring().strip()
            if definition.type == 'module':
                signature = definition.full_name
                try:
                    description = definition.docstring(raw=True).strip()
                except Exception:
                    description = ''
                if not description and hasattr(definition, 'get_line_code'):
                    # jedi returns an empty string for compiled objects
                    description = definition.docstring().strip()
            _definition = {
                'type': self._get_definition_type(definition),
                'text': definition.name,
                'description': description,
                'docstring': description, 
                'signature': signature
            }
            _definitions.append(_definition)
        return json.dumps({'id': identifier, 'results': _definitions})

    def _serialize_usages(self, usages, identifier=None):
        _usages = []
        for usage in usages:
            _usages.append({
                'name': usage.name,
                'moduleName': usage.module_name,
                'fileName': usage.module_path,
                'line': usage.line,
                'column': usage.column,
            })
        return json.dumps({'id': identifier, 'results': _usages})

    def _deserialize(self, request):
        """Deserialize request from VSCode.

        Args:
            request: String with raw request from VSCode.

        Returns:
            Python dictionary with request data.
        """
        return json.loads(request)

    def _set_request_config(self, config):
        """Sets config values for current request.

        This includes sys.path modifications which is getting restored to
        default value on each request so each project should be isolated
        from each other.

        Args:
            config: Dictionary with config values.
        """
        sys.path = self.default_sys_path
        self.use_snippets = config.get('useSnippets')
        self.show_doc_strings = config.get('showDescriptions', True)
        self.fuzzy_matcher = config.get('fuzzyMatcher', False)
        jedi.settings.case_insensitive_completion = config.get(
            'caseInsensitiveCompletion', True)
        for path in config.get('extraPaths', []):
            if path and path not in sys.path:
                sys.path.insert(0, path)

    def _process_request(self, request):
        """Accept serialized request from VSCode and write response.
        """
        request = self._deserialize(request)

        self._set_request_config(request.get('config', {}))

        path = self._get_top_level_module(request.get('path', ''))
        if path not in sys.path:
            sys.path.insert(0, path)
        lookup = request.get('lookup', 'completions')

        if lookup == 'names':
            return self._write_response(self._serialize_definitions(
                jedi.api.names(
                    source=request.get('source', None),
                    path=request.get('path', ''),
                    all_scopes=True),
                request['id']))

        script = jedi.api.Script(
            source=request.get('source', None), line=request['line'] + 1,
            column=request['column'], path=request.get('path', ''))
        
        if lookup == 'definitions':
            defs = self._get_definitionsx(script.goto_definitions(), request['id'])
            if len(defs) == 0:
                defs = self._get_definitionsx(script.goto_assignments(), request['id'])
            return self._write_response(json.dumps({'id': request['id'], 'results': defs}))
        if lookup == 'tooltip':
            if jediPreview:
                defs = self._get_definitionsx(script.goto_definitions(), request['id'], True)
                if len(defs) == 0:
                    defs = self._get_definitionsx(script.goto_assignments(), request['id'], True)
                return self._write_response(json.dumps({'id': request['id'], 'results': defs}))
            else:
                return self._write_response(self._serialize_tooltip(script.goto_definitions(), request['id']))
        elif lookup == 'arguments':
            return self._write_response(self._serialize_arguments(
                script, request['id']))
        elif lookup == 'usages':
            return self._write_response(self._serialize_usages(
                script.usages(), request['id']))
        elif lookup == 'methods':
          return self._write_response(
              self._serialize_methods(script, request['id'],
                                      request.get('prefix', '')))
        else:
            return self._write_response(
                self._serialize_completions(script, request['id'],
                                            request.get('prefix', '')))

    def _write_response(self, response):
        sys.stdout.write(response + '\n')
        sys.stdout.flush()

    def watch(self):
        while True:
            try:
                rq = self._input.readline()
                if len(rq) == 0:
                    # Reached EOF - indication our parent process is gone. 
                    sys.stderr.write('Received EOF from the standard input,exiting' + '\n')
                    sys.stderr.flush()
                    return
                self._process_request(rq)

            except Exception:
                sys.stderr.write(traceback.format_exc() + '\n')
                sys.stderr.flush()

if __name__ == '__main__':
    cachePrefix = 'v'
    modulesToLoad = ''
    if len(sys.argv) > 0 and sys.argv[1] == 'preview':
        jediPath = os.path.join(os.path.dirname(__file__), 'preview')
        jediPreview = True
        if len(sys.argv) > 2:
            modulesToLoad = sys.argv[2]
    elif len(sys.argv) > 0 and sys.argv[1] == 'custom':
        jediPath = sys.argv[2]
        jediPreview = True
        cachePrefix = 'custom_v'
        if len(sys.argv) > 3:
            modulesToLoad = sys.argv[3]
    else:
        #std
        jediPath = os.path.join(os.path.dirname(__file__), 'release')
        if len(sys.argv) > 2:
            modulesToLoad = sys.argv[2]

    sys.path.insert(0, jediPath)
    import jedi
    if jediPreview:
        jedi.settings.cache_directory = os.path.join(
            jedi.settings.cache_directory, cachePrefix + jedi.__version__.replace('.', ''))
    # remove jedi from path after we import it so it will not be completed
    sys.path.pop(0)
    if len(modulesToLoad) > 0:
        jedi.preload_module(*modulesToLoad.split(','))
    JediCompletion().watch()
