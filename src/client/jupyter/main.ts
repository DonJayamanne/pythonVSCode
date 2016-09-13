// var AutocompleteProvider, CodeManager, CompositeDisposable, Config, Inspector, KernelPicker, ResultView, SignalListView, WSKernelPicker, _;
// CompositeDisposable = require('atom').CompositeDisposable;
const _ = require('lodash');
// ResultView = require('./result-view');
// SignalListView = require('./signal-list-view');
// KernelPicker = require('./kernel-picker');
// WSKernelPicker = require('./ws-kernel-picker');
// CodeManager = require('./code-manager');
// Config = require('./config');
import {KernelManager} from './kernel-manager';
// Inspector = require('./inspector');
// AutocompleteProvider = require('./autocomplete-provider');
import * as vscode from 'vscode';

export class Hydrogen {
    // config: Config.schema;
    public subscriptions = null;
    public kernelManager:KernelManager;
    // public inspector = null;
    public editor: vscode.TextEditor;
    public kernel = null;
    public markerBubbleMap = null;
    public statusBarElement = null;
    public statusBarTile = null;
    public watchSidebar = null;
    public watchSidebarIsVisible = false;
    activate(state) {
        this.kernelManager = new KernelManager();
        // this.inspector = new Inspector(this.kernelManager);
        // this.codeManager = new CodeManager();
        this.markerBubbleMap = {};
        // this.statusBarElement = document.createElement('div');
        // this.statusBarElement.classList.add('hydrogen');
        // this.statusBarElement.classList.add('status-container');
        // this.statusBarElement.onclick = this.showKernelCommands.bind(this);
        // this.onEditorChanged(atom.workspace.getActiveTextEditor());
        vscode.window.onDidChangeActiveTextEditor(this.onEditorChanged.bind(this));
        // this.subscriptions = new CompositeDisposable;
        // this.subscriptions.add(atom.commands.add('atom-text-editor', {
        //     'hydrogen:run': (function (_this) {
        //         return function () {
        //             return _this.run();
        //         };
        //     })(this),
        //     'hydrogen:run-all': (function (_this) {
        //         return function () {
        //             return _this.runAll();
        //         };
        //     })(this),
        //     'hydrogen:run-all-above': (function (_this) {
        //         return function () {
        //             return _this.runAllAbove();
        //         };
        //     })(this),
        //     'hydrogen:run-and-move-down': (function (_this) {
        //         return function () {
        //             return _this.run(true);
        //         };
        //     })(this),
        //     'hydrogen:run-cell': (function (_this) {
        //         return function () {
        //             return _this.runCell();
        //         };
        //     })(this),
        //     'hydrogen:run-cell-and-move-down': (function (_this) {
        //         return function () {
        //             return _this.runCell(true);
        //         };
        //     })(this),
        //     'hydrogen:toggle-watches': (function (_this) {
        //         return function () {
        //             return _this.toggleWatchSidebar();
        //         };
        //     })(this),
        //     'hydrogen:select-kernel': (function (_this) {
        //         return function () {
        //             return _this.showKernelPicker();
        //         };
        //     })(this),
        //     'hydrogen:connect-to-remote-kernel': (function (_this) {
        //         return function () {
        //             return _this.showWSKernelPicker();
        //         };
        //     })(this),
        //     'hydrogen:add-watch': (function (_this) {
        //         return function () {
        //             var ref;
        //             if (!_this.watchSidebarIsVisible) {
        //                 _this.toggleWatchSidebar();
        //             }
        //             return (ref = _this.watchSidebar) != null ? ref.addWatchFromEditor() : void 0;
        //         };
        //     })(this),
        //     'hydrogen:remove-watch': (function (_this) {
        //         return function () {
        //             var ref;
        //             if (!_this.watchSidebarIsVisible) {
        //                 _this.toggleWatchSidebar();
        //             }
        //             return (ref = _this.watchSidebar) != null ? ref.removeWatch() : void 0;
        //         };
        //     })(this),
        //     'hydrogen:update-kernels': (function (_this) {
        //         return function () {
        //             return _this.kernelManager.updateKernelSpecs();
        //         };
        //     })(this),
        //     'hydrogen:toggle-inspector': (function (_this) {
        //         return function () {
        //             return _this.inspector.toggle();
        //         };
        //     })(this),
        //     'hydrogen:interrupt-kernel': (function (_this) {
        //         return function () {
        //             return _this.handleKernelCommand({
        //                 command: 'interrupt-kernel'
        //             });
        //         };
        //     })(this),
        //     'hydrogen:restart-kernel': (function (_this) {
        //         return function () {
        //             return _this.handleKernelCommand({
        //                 command: 'restart-kernel'
        //             });
        //         };
        //     })(this),
        //     'hydrogen:shutdown-kernel': (function (_this) {
        //         return function () {
        //             return _this.handleKernelCommand({
        //                 command: 'shutdown-kernel'
        //             });
        //         };
        //     })(this),
        //     'hydrogen:copy-path-to-connection-file': (function (_this) {
        //         return function () {
        //             return _this.copyPathToConnectionFile();
        //         };
        //     })(this)
        // }));
        // this.subscriptions.add(atom.commands.add('atom-workspace', {
        //     'hydrogen:clear-results': (function (_this) {
        //         return function () {
        //             return _this.clearResultBubbles();
        //         };
        //     })(this)
        // }));
        // return this.subscriptions.add(atom.workspace.observeActivePaneItem((function (_this) {
        //     return function (item) {
        //         if (item && item === atom.workspace.getActiveTextEditor()) {
        //             return _this.onEditorChanged(item);
        //         }
        //     };
        // })(this)));
    }
    deactivate() {
        this.subscriptions.dispose();
        this.kernelManager.destroy();
        return this.statusBarTile.destroy();
    }
    consumeStatusBar(statusBar) {
        return this.statusBarTile = statusBar.addLeftTile({
            item: this.statusBarElement,
            priority: 100
        });
    }
    provide() {
        // if (atom.config.get('Hydrogen.autocomplete') === true) {
        //     return AutocompleteProvider(this.kernelManager);
        // }
    }
    onEditorChanged(editor) {
        var grammar, kernel, language;
        this.editor = editor;
        if (this.editor) {
            // grammar = this.editor.getGrammar();
            grammar = 'python';
            language = this.kernelManager.getLanguageFor(grammar);
            kernel = this.kernelManager.getRunningKernelFor(language);
            // this.codeManager.editor = this.editor;
        }
        if (this.kernel !== kernel) {
            return this.onKernelChanged(kernel);
        }
    }
    onKernelChanged(kernel1?) {
        this.kernel = kernel1;
        this.setStatusBar();
        return this.setWatchSidebar(this.kernel);
    }
    setStatusBar() {
        if (this.statusBarElement == null) {
            console.error('setStatusBar: there is no status bar');
            return;
        }
        this.clearStatusBar();
        if (this.kernel != null) {
            return this.statusBarElement.appendChild(this.kernel.statusView.element);
        }
    }
    clearStatusBar() {
        var results;
        if (this.statusBarElement == null) {
            console.error('clearStatusBar: there is no status bar');
            return;
        }
        results = [];
        while (this.statusBarElement.hasChildNodes()) {
            results.push(this.statusBarElement.removeChild(this.statusBarElement.lastChild));
        }
        return results;
    }
    setWatchSidebar(kernel) {
        var ref, ref1, sidebar;
        console.log('setWatchSidebar:', kernel);
        sidebar = kernel != null ? kernel.watchSidebar : void 0;
        if (this.watchSidebar === sidebar) {
            return;
        }
        if ((ref = this.watchSidebar) != null ? ref.visible : void 0) {
            this.watchSidebar.hide();
        }
        this.watchSidebar = sidebar;
        if (this.watchSidebarIsVisible) {
            return (ref1 = this.watchSidebar) != null ? ref1.show() : void 0;
        }
    }
    toggleWatchSidebar() {
        var ref, ref1;
        if (this.watchSidebarIsVisible) {
            console.log('toggleWatchSidebar: hiding sidebar');
            this.watchSidebarIsVisible = false;
            return (ref = this.watchSidebar) != null ? ref.hide() : void 0;
        } else {
            console.log('toggleWatchSidebar: showing sidebar');
            this.watchSidebarIsVisible = true;
            return (ref1 = this.watchSidebar) != null ? ref1.show() : void 0;
        }
    }
    showKernelCommands() {
        throw new Error('Oops');
        // if (this.signalListView == null) {
        //     this.signalListView = new SignalListView(this.kernelManager);
        //     this.signalListView.onConfirmed = (function (_this) {
        //         return function (kernelCommand) {
        //             return _this.handleKernelCommand(kernelCommand);
        //         };
        //     })(this);
        // }
        // return this.signalListView.toggle();
    }
    handleKernelCommand(arg) {
        var command, grammar, kernel, kernelSpec, language, message;
        kernel = arg.kernel, command = arg.command, grammar = arg.grammar, language = arg.language, kernelSpec = arg.kernelSpec;
        console.log('handleKernelCommand:', arguments);
        if (!grammar) {
            // grammar = this.editor.getGrammar();
            grammar = 'python';
        }
        if (!language) {
            language = this.kernelManager.getLanguageFor(grammar);
        }
        if (!kernel) {
            kernel = this.kernelManager.getRunningKernelFor(language);
        }
        if (!kernel) {
            message = "No running kernel for language `" + language + "` found";
            // atom.notifications.addError(message);
            vscode.window.showErrorMessage(message);
            return;
        }
        if (command === 'interrupt-kernel') {
            return kernel.interrupt();
        } else if (command === 'restart-kernel') {
            this.clearResultBubbles();
            return this.kernelManager.restartRunningKernelFor(grammar, (function (_this) {
                return function (kernel) {
                    return _this.onKernelChanged(kernel);
                };
            })(this));
        } else if (command === 'shutdown-kernel') {
            this.clearResultBubbles();
            kernel.shutdown();
            this.kernelManager.destroyRunningKernelFor(grammar);
            return this.onKernelChanged();
        } else if (command === 'switch-kernel') {
            this.clearResultBubbles();
            this.kernelManager.destroyRunningKernelFor(grammar);
            return this.kernelManager.startKernel(kernelSpec, grammar, (function (_this) {
                return function (kernel) {
                    return _this.onKernelChanged(kernel);
                };
            })(this));
        } else if (command === 'rename-kernel') {
            return typeof kernel.promptRename === "function" ? kernel.promptRename() : void 0;
        } else if (command === 'disconnect-kernel') {
            this.clearResultBubbles();
            this.kernelManager.destroyRunningKernelFor(grammar);
            return this.onKernelChanged();
        }
    }
    createResultBubble(code, row) {
        if (this.kernel) {
            this._createResultBubble(this.kernel, code, row);
            return;
        }
        // return this.kernelManager.startKernelFor(this.editor.getGrammar(), (function (_this) {
        return this.kernelManager.startKernelFor('python', (function (_this) {
            return function (kernel) {
                _this.onKernelChanged(kernel);
                return _this._createResultBubble(kernel, code, row);
            };
        })(this));
    }
    _createResultBubble(kernel, code, row) {
        // var view;
        // if (this.watchSidebar.element.contains(document.activeElement)) {
        //     this.watchSidebar.run();
        //     return;
        // }
        // this.clearBubblesOnRow(row);
        // view = this.insertResultBubble(row);
        return kernel.execute(code, function (result) {
            vscode.window.showInformationMessage('yay' + result)
            vscode.window.showInformationMessage('yay' + result)
            vscode.window.showInformationMessage('yay' + result)
            // view.spin(false);
            // return view.addResult(result);
        });
    }
    insertResultBubble(row) {
        // var buffer, element, lineHeight, lineLength, marker, view;
        // buffer = this.editor.getBuffer();
        // lineLength = buffer.lineLengthForRow(row);
        // marker = this.editor.markBufferPosition({
        //     row: row,
        //     column: lineLength
        // }, {
        //         invalidate: 'touch'
        //     });
        // view = new ResultView(marker);
        // view.spin(true);
        // element = view.element;
        // lineHeight = this.editor.getLineHeightInPixels();
        // view.spinner.setAttribute('style', "width: " + (lineHeight + 2) + "px; height: " + (lineHeight - 4) + "px;");
        // view.statusContainer.setAttribute('style', "height: " + lineHeight + "px");
        // element.setAttribute('style', "margin-left: " + (lineLength + 1) + "ch; margin-top: -" + lineHeight + "px");
        // this.editor.decorateMarker(marker, {
        //     type: 'block',
        //     item: element,
        //     position: 'after'
        // });
        // this.markerBubbleMap[marker.id] = view;
        // marker.onDidChange((function (_this) {
        //     return function (event) {
        //         console.log('marker.onDidChange:', marker);
        //         if (!event.isValid) {
        //             view.destroy();
        //             marker.destroy();
        //             return delete _this.markerBubbleMap[marker.id];
        //         } else {
        //             if (!element.classList.contains('multiline')) {
        //                 lineLength = marker.getStartBufferPosition()['column'];
        //                 return element.setAttribute('style', "margin-left: " + (lineLength + 1) + "ch; margin-top: -" + lineHeight + "px");
        //             }
        //         }
        //     };
        // })(this));
        // return view;
    }
    clearResultBubbles() {
        // _.forEach(this.markerBubbleMap, function (bubble) {
        //     return bubble.destroy();
        // });
        // return this.markerBubbleMap = {};
    }
    clearBubblesOnRow(row) {
        // console.log('clearBubblesOnRow:', row);
        // return _.forEach(this.markerBubbleMap, (function (_this) {
        //     return function (bubble) {
        //         var marker, range;
        //         marker = bubble.marker;
        //         range = marker.getBufferRange();
        //         if ((range.start.row <= row && row <= range.end.row)) {
        //             console.log('clearBubblesOnRow:', row, bubble);
        //             bubble.destroy();
        //             return delete _this.markerBubbleMap[marker.id];
        //         }
        //     };
        // })(this));
    }
    run(moveDown) {
        // var code, codeBlock, row;
        // if (moveDown == null) {
        //     moveDown = false;
        // }
        // codeBlock = this.codeManager.findCodeBlock();
        // if (codeBlock == null) {
        //     return;
        // }
        // code = codeBlock[0], row = codeBlock[1];
        // if ((code != null) && (row != null)) {
        //     if (moveDown === true) {
        //         this.codeManager.moveDown(row);
        //     }
        //     return this.createResultBubble(code, row);
        // }
        const code = vscode.window.activeTextEditor.document.getText(vscode.window.activeTextEditor.selection)
        return this.createResultBubble(code, null)
    }
    // runAll() {
    //     if (this.kernel) {
    //         this._runAll(this.kernel);
    //         return;
    //     }
    //     return this.kernelManager.startKernelFor(this.editor.getGrammar(), (function (_this) {
    //         return function (kernel) {
    //             _this.onKernelChanged(kernel);
    //             return _this._runAll(kernel);
    //         };
    //     })(this));
    // }
    // _runAll(kernel) {
    //     var breakpoints, buffer, code, end, endRow, i, j, ref, results, start;
    //     breakpoints = this.codeManager.getBreakpoints();
    //     buffer = this.editor.getBuffer();
    //     results = [];
    //     for (i = j = 1, ref = breakpoints.length; 1 <= ref ? j < ref : j > ref; i = 1 <= ref ? ++j : --j) {
    //         start = breakpoints[i - 1];
    //         end = breakpoints[i];
    //         code = buffer.getTextInRange([start, end]);
    //         endRow = this.codeManager.escapeBlankRows(start.row, end.row);
    //         results.push(this._createResultBubble(kernel, code, endRow));
    //     }
    //     return results;
    // }
    // runAllAbove() {
    //     var code, cursor, row;
    //     cursor = this.editor.getLastCursor();
    //     row = this.codeManager.escapeBlankRows(0, cursor.getBufferRow());
    //     code = this.codeManager.getRows(0, row);
    //     if ((code != null) && (row != null)) {
    //         return this.createResultBubble(code, row);
    //     }
    // }
    // runCell(moveDown) {
    //     var buffer, code, end, endRow, ref, start;
    //     if (moveDown == null) {
    //         moveDown = false;
    //     }
    //     ref = this.codeManager.getCurrentCell(), start = ref[0], end = ref[1];
    //     buffer = this.editor.getBuffer();
    //     code = buffer.getTextInRange([start, end]);
    //     endRow = this.codeManager.escapeBlankRows(start.row, end.row);
    //     if (code != null) {
    //         if (moveDown === true) {
    //             this.codeManager.moveDown(endRow);
    //         }
    //         return this.createResultBubble(code, endRow);
    //     }
    // }
    // showKernelPicker() {
    //     if (this.kernelPicker == null) {
    //         this.kernelPicker = new KernelPicker((function (_this) {
    //             return function (callback) {
    //                 var grammar, language;
    //                 grammar = _this.editor.getGrammar();
    //                 language = _this.kernelManager.getLanguageFor(grammar);
    //                 return _this.kernelManager.getAllKernelSpecsFor(language, function (kernelSpecs) {
    //                     return callback(kernelSpecs);
    //                 });
    //             };
    //         })(this));
    //         this.kernelPicker.onConfirmed = (function (_this) {
    //             return function (arg) {
    //                 var kernelSpec;
    //                 kernelSpec = arg.kernelSpec;
    //                 return _this.handleKernelCommand({
    //                     command: 'switch-kernel',
    //                     kernelSpec: kernelSpec
    //                 });
    //             };
    //         })(this);
    //     }
    //     return this.kernelPicker.toggle();
    // }
    // showWSKernelPicker() {
    //     var grammar, language;
    //     if (this.wsKernelPicker == null) {
    //         this.wsKernelPicker = new WSKernelPicker((function (_this) {
    //             return function (kernel) {
    //                 var grammar;
    //                 _this.clearResultBubbles();
    //                 grammar = kernel.grammar;
    //                 _this.kernelManager.destroyRunningKernelFor(grammar);
    //                 _this.kernelManager.setRunningKernelFor(grammar, kernel);
    //                 return _this.onKernelChanged(kernel);
    //             };
    //         })(this));
    //     }
    //     grammar = this.editor.getGrammar();
    //     language = this.kernelManager.getLanguageFor(grammar);
    //     return this.wsKernelPicker.toggle(grammar, (function (_this) {
    //         return function (kernelSpec) {
    //             return _this.kernelManager.kernelSpecProvidesLanguage(kernelSpec, language);
    //         };
    //     })(this));
    // }
    // copyPathToConnectionFile() {
    //     var connectionFile, description, grammar, language, message;
    //     grammar = this.editor.getGrammar();
    //     language = this.kernelManager.getLanguageFor(grammar);
    //     if (this.kernel == null) {
    //         message = "No running kernel for language `" + language + "` found";
    //         atom.notifications.addError(message);
    //         return;
    //     }
    //     connectionFile = this.kernel.connectionFile;
    //     if (connectionFile == null) {
    //         atom.notifications.addError("No connection file for " + this.kernel.kernelSpec.display_name + " kernel found");
    //         return;
    //     }
    //     atom.clipboard.write(connectionFile);
    //     message = 'Path to connection file copied to clipboard.';
    //     description = "Use `jupyter console --existing " + connectionFile + "` to connect to the running kernel.";
    //     return atom.notifications.addSuccess(message, {
    //         description: description
    //     });
    // }
};

// ---
// generated by coffee-script 1.9.2