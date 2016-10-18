import * as vscode from 'vscode';
import { OutputChannel, StatusBarAlignment, StatusBarItem } from 'vscode';

export interface IWindowsSrevice {
    /**
     * Create a new [output channel](#OutputChannel) with the given name.
     *
     * @param name Human-readable string which will be used to represent the channel in the UI.
     */
    createOutputChannel(name: string): OutputChannel;
    /**
     * Creates a status bar [item](#StatusBarItem).
     *
     * @param alignment The alignment of the item.
     * @param priority The priority of the item. Higher values mean the item should be shown more to the left.
     * @return A new status bar item.
     */
    createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
    /**
     * Show an information message to users. Optionally provide an array of items which will be presented as
     * clickable buttons.
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showInformationMessage(message: string, ...items: string[]): Thenable<string>;
    /**
     * Show a warning message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showWarningMessage(message: string, ...items: string[]): Thenable<string>;
    /**
     * Show an error message.
     *
     * @see [showInformationMessage](#window.showInformationMessage)
     *
     * @param message The message to show.
     * @param items A set of items that will be rendered as actions in the message.
     * @return A thenable that resolves to the selected item or `undefined` when being dismissed.
     */
    showErrorMessage(message: string, ...items: string[]): Thenable<string>;
}

export class WindowService implements IWindowsSrevice {
    public createOutputChannel(name: string): OutputChannel {
        return vscode.window.createOutputChannel(name);
    }
    public createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem {
        return vscode.window.createStatusBarItem.apply(vscode.window, arguments);
    }
    public showInformationMessage(message: string, ...items: string[]): Thenable<string> {
        return vscode.window.showInformationMessage.apply(vscode.window, arguments);
    }
    public showWarningMessage(message: string, ...items: string[]): Thenable<string> {
        return vscode.window.showWarningMessage.apply(vscode.window, arguments);
    }
    public showErrorMessage(message: string, ...items: string[]): Thenable<string> {
        return vscode.window.showErrorMessage.apply(vscode.window, arguments);
    }
}
