1. What is the purpose of `src/client/gather/*.ts`

-   What is excution Slicer

2. Is nodebook the object that carries information about everything (i.e. considered the session object)

3. What is `InteractiveBase` in `interactiveBase.ts`.


4. Explain `IInteractiveWindowListener`

-   Who sends and who receives.
-   Who fires the event & who handles the responses.

5. How is this different from `IWebPanelMessageListener`.
This is used to wire up post office.
One per webview host (top level)

6. What is the `IInteractiveBase` interface
Dervied by interactive windows.

7. What is the difference betwee `IInteractiveBase` and `IInteractiveWindow`
   I.e. why the inheritance and why not just have `IInteractiveWindow`.
* IInteractiveWindow - has add code (this is the interactive window, not the native editor)
* IInteractiveBase - no add code (this is the base for both native editor & interactive window).



8. What is the `InteractiveWindow` class, where is this used. I.e. what UI element does this relate to?

9. What is the difference between `InteractiveWindow` and `NativeEditor`.

10. Where is `NativeEditorProvider` used, i.e. who calls this?

11. Why not close then open
    Here user opens a doc, then we open our doc, then we switch and close it and our doc is dispalyed. There some flickering.
    Why not just close the users doc and open ours?

```typescript
const contents = document.getText();
const uri = document.uri;

// Open our own editor.
await this.open(uri, contents);

// Then switch back to the ipynb and close it.
// If we don't do it in this order, the close will switch to the wrong item
await this.documentManager.showTextDocument(document);
const command = 'workbench.action.closeActiveEditor';
await this.cmdManager.executeCommand(command);
```

12. Please explain and go through `InteractiveWindow` class.
    Some of the key methods.

13. Get an understanding of Jupyter session manager, etc.
    How are the sessions created, managed and how are messages sent and received.

14. What is the difference between `Jupyter` and `Notebook`.
    E.g. why is the interface named `IJupyterDebugger` and not `INotebookDebugger`.
    Trying to understand whether there was a reason or whether they are both similar and can be used interchangeably. I.e. would `INotebookDebugger` still mean the same.

15. What is the relationship between a `JupyterSession` and `Notebook`.
16. What are `notebookFiles` in the `JupyterSession` class.
    ```typescript
    private notebookFiles: Contents.IModel[] = [];
    ```
17. When it `waitForPromise` times out, the promise isn't rejected!
    However this code assumes it is.
    Also it doesn't make sense, when is `e` undefined?
    The `if (!e)` implies that `e` can be undefined.

```typescript
// Wait for this kernel promise to happen
try {
    return await waitForPromise(kernelPromise, timeout);
} catch (e) {
    if (!e) {
        // We timed out. Throw a specific exception
        throw new JupyterKernelPromiseFailedError(errorMessage);
    }
    throw e;
}
```

18. This can be dangerous.

```typescript
await waitForPromise(session.shutdown(), 1000);
```

Basically, its possible the `shutdown` will timeout. hence code will continue.
However `shutdown` will continue to run and it will run and could throw an exception later on, and that won't be handled, as code has moved on.

19. In `JupyterSession.shutdown` why do we need to ensure the session is running?
    I.e. why call `sessionManager.refreshRunning`?

20. `JupyterSession.shutdownSession` is best turned into a static method.

21. Why not log the current status of the kernel. This way we have more context of what's going on and we can try to figure out the delays (timeouts) on CI.

```typescript
throw new JupyterWaitForIdleError(localize.DataScience.jupyterLaunchTimedOut());
```

22. What is the purpose of `JupyterSession.waitForIdleOnSession`?
    Is this to wait for the session to be idle so we can send commands to it?
    I.e. why do we need to wait for idle, or another way of asking this question is, what if we didn't want and removed this wait?

23. When running some code that's required for extension (e.g. setting backgrounds for matplotlib, getting python version,etc).
    In such cases they are executed as silent without the history.
    Some of them don't require a result. E.g. setting the background colors for matplot lib.
    Why don't we just ignore that (we can use `silent` in the request. Today we're using `store_history` for these).
    Any reason, or just to avoid having to set both of them!

24. Do we maintain our own cell counter (history).
    Is this mapped to the one coming form jupyter.

25. Do we shutdown kernels when closing VS Code?
    If not we have a lot of these orphaned processes that chew up memory and CPU

26. Creation of kernel specs. When and why do we do this?
