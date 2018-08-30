'use strict';
import { inject, injectable } from 'inversify';
import { Event, EventEmitter, StatusBarAlignment, StatusBarItem } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import * as constants from '../../common/constants';
import { noop } from '../../common/core.utils';
import { isNotInstalledError } from '../../common/helpers';
import { IConfigurationService } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { CANCELLATION_REASON } from '../common/constants';
import { ITestsHelper, Tests } from '../common/types';
import { ITestResultDisplay } from '../types';

@injectable()
export class TestResultDisplay implements ITestResultDisplay {
    private statusBar: StatusBarItem;
    private discoverCounter = 0;
    private ticker = ['|', '/', '-', '|', '/', '-', '\\'];
    private progressTimeout;
    private _enabled: boolean = false;
    private progressPrefix!: string;
    private readonly didChange = new EventEmitter<void>();
    private readonly appShell: IApplicationShell;
    private readonly testsHelper: ITestsHelper;
    public get onDidChange(): Event<void> {
        return this.didChange.event;
    }

    // tslint:disable-next-line:no-any
    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer) {
        this.appShell = serviceContainer.get<IApplicationShell>(IApplicationShell);
        this.statusBar = this.appShell.createStatusBarItem(StatusBarAlignment.Left);
        this.testsHelper = serviceContainer.get<ITestsHelper>(ITestsHelper);
    }
    public dispose() {
        this.clearProgressTicker();
        this.statusBar.dispose();
    }
    public get enabled() {
        return this._enabled;
    }
    public set enabled(enable: boolean) {
        this._enabled = enable;
        if (enable) {
            this.statusBar.show();
        } else {
            this.statusBar.hide();
        }
    }
    public displayProgressStatus(testRunResult: Promise<Tests>, debug: boolean = false) {
        this.displayProgress('Running Tests', 'Running Tests (Click to Stop)', constants.Commands.Tests_Ask_To_Stop_Test);
        testRunResult
            .then(tests => this.updateTestRunWithSuccess(tests, debug))
            .catch(this.updateTestRunWithFailure.bind(this))
            // We don't care about any other exceptions returned by updateTestRunWithFailure
            .catch(noop);
    }
    public displayDiscoverStatus(testDiscovery: Promise<Tests>, quietMode: boolean = false) {
        this.displayProgress('Discovering Tests', 'Discovering tests (click to stop)', constants.Commands.Tests_Ask_To_Stop_Discovery);
        return testDiscovery.then(tests => {
            this.updateWithDiscoverSuccess(tests, quietMode);
            return tests;
        }).catch(reason => {
            this.updateWithDiscoverFailure(reason);
            return Promise.reject(reason);
        });
    }

    private updateTestRunWithSuccess(tests: Tests, debug: boolean = false): Tests {
        this.clearProgressTicker();

        // Treat errors as a special case, as we generally wouldn't have any errors
        const statusText: string[] = [];
        const toolTip: string[] = [];
        let foreColor = '';

        if (tests.summary.passed > 0) {
            statusText.push(`${constants.Octicons.Test_Pass} ${tests.summary.passed}`);
            toolTip.push(`${tests.summary.passed} Passed`);
            foreColor = '#66ff66';
        }
        if (tests.summary.skipped > 0) {
            statusText.push(`${constants.Octicons.Test_Skip} ${tests.summary.skipped}`);
            toolTip.push(`${tests.summary.skipped} Skipped`);
            foreColor = '#66ff66';
        }
        if (tests.summary.failures > 0) {
            statusText.push(`${constants.Octicons.Test_Fail} ${tests.summary.failures}`);
            toolTip.push(`${tests.summary.failures} Failed`);
            foreColor = 'yellow';
        }
        if (tests.summary.errors > 0) {
            statusText.push(`${constants.Octicons.Test_Error} ${tests.summary.errors}`);
            toolTip.push(`${tests.summary.errors} Error${tests.summary.errors > 1 ? 's' : ''}`);
            foreColor = 'yellow';
        }
        this.statusBar.tooltip = toolTip.length === 0 ? 'No Tests Ran' : `${toolTip.join(', ')} (Tests)`;
        this.statusBar.text = statusText.length === 0 ? 'No Tests Ran' : statusText.join(' ');
        this.statusBar.color = foreColor;
        this.statusBar.command = constants.Commands.Tests_View_UI;
        this.didChange.fire();
        if (statusText.length === 0 && !debug) {
            this.appShell.showWarningMessage('No tests ran, please check the configuration settings for the tests.');
        }
        return tests;
    }

    // tslint:disable-next-line:no-any
    private updateTestRunWithFailure(reason: any): Promise<any> {
        this.clearProgressTicker();
        this.statusBar.command = constants.Commands.Tests_View_UI;
        if (reason === CANCELLATION_REASON) {
            this.statusBar.text = '$(zap) Run Tests';
            this.statusBar.tooltip = 'Run Tests';
        } else {
            this.statusBar.text = '$(alert) Tests Failed';
            this.statusBar.tooltip = 'Running Tests Failed';
            this.testsHelper.displayTestErrorMessage('There was an error in running the tests.');
        }
        return Promise.reject(reason);
    }

    private displayProgress(message: string, tooltip: string, command: string) {
        this.progressPrefix = this.statusBar.text = `$(stop) ${message}`;
        this.statusBar.command = command;
        this.statusBar.tooltip = tooltip;
        this.statusBar.show();
        this.clearProgressTicker();
        this.progressTimeout = setInterval(() => this.updateProgressTicker(), 150);
    }
    private updateProgressTicker() {
        const text = `${this.progressPrefix} ${this.ticker[this.discoverCounter % 7]}`;
        this.discoverCounter += 1;
        this.statusBar.text = text;
    }
    private clearProgressTicker() {
        if (this.progressTimeout) {
            clearInterval(this.progressTimeout);
        }
        this.progressTimeout = null;
        this.discoverCounter = 0;
    }

    // tslint:disable-next-line:no-any
    private async disableTests(): Promise<any> {
        const configurationService = this.serviceContainer.get<IConfigurationService>(IConfigurationService);
        const settingsToDisable = ['unitTest.promptToConfigure', 'unitTest.pyTestEnabled',
            'unitTest.unittestEnabled', 'unitTest.nosetestsEnabled'];

        for (const setting of settingsToDisable) {
            await configurationService.updateSettingAsync(setting, false).catch(noop);
        }
    }

    private updateWithDiscoverSuccess(tests: Tests, quietMode: boolean = false) {
        this.clearProgressTicker();
        const haveTests = tests && (tests.testFunctions.length > 0);
        this.statusBar.text = '$(zap) Run Tests';
        this.statusBar.tooltip = 'Run Tests';
        this.statusBar.command = constants.Commands.Tests_View_UI;
        this.statusBar.show();
        if (this.didChange) {
            this.didChange.fire();
        }

        if (!haveTests && !quietMode) {
            this.appShell.showInformationMessage('No tests discovered, please check the configuration settings for the tests.', 'Disable Tests').then(item => {
                if (item === 'Disable Tests') {
                    this.disableTests()
                        .catch(ex => console.error('Python Extension: disableTests', ex));
                }
            });
        }
    }

    // tslint:disable-next-line:no-any
    private updateWithDiscoverFailure(reason: any) {
        this.clearProgressTicker();
        this.statusBar.text = '$(zap) Discover Tests';
        this.statusBar.tooltip = 'Discover Tests';
        this.statusBar.command = constants.Commands.Tests_Discover;
        this.statusBar.show();
        this.statusBar.color = 'yellow';
        if (reason !== CANCELLATION_REASON) {
            this.statusBar.text = '$(alert) Test discovery failed';
            this.statusBar.tooltip = 'Discovering Tests failed (view \'Python Test Log\' output panel for details)';
            // tslint:disable-next-line:no-suspicious-comment
            // TODO: ignore this quitemode, always display the error message (inform the user).
            if (!isNotInstalledError(reason)) {
                // tslint:disable-next-line:no-suspicious-comment
                // TODO: show an option that will invoke a command 'python.test.configureTest' or similar.
                // This will be hanlded by main.ts that will capture input from user and configure the tests.
                this.appShell.showErrorMessage('Test discovery error, please check the configuration settings for the tests.');
            }
        }
    }
}
