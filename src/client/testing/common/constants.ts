export const CANCELLATION_REASON = 'cancelled_user_request';
export enum CommandSource {
    auto = 'auto',
    ui = 'ui',
    codelens = 'codelens',
    commandPalette = 'commandpalette',
    testExplorer = 'testExplorer'
}
export const TEST_OUTPUT_CHANNEL = 'TEST_OUTPUT_CHANNEL';

export enum Icons {
    discovering = 'discovering-tests.svg',
    passed = 'status-ok.svg',
    failed = 'status-error.svg',
    unknown = 'status-unknown.svg'
}
