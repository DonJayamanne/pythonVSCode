# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import behave

import uitests.tools
import uitests.vscode.output_panel


@behave.then('the output panel contains the text "{text}"')
@uitests.tools.retry(AssertionError, tries=100, delay=1)
def then_output_contains(context, text):
    """Add retries, e.g. download LS can be slow on CI"""
    lines = uitests.vscode.output_panel.get_output_panel_lines(context)
    assert text.lower() in "".join(lines).lower()
