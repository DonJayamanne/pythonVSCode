export function getFirstNonEmptyLineFromMultilineString(stdout: string) {
    if (stdout.length === 0) {
        return '';
    }
    const lines = stdout.split(/\r?\n/g).filter(line => line.trim().length > 0);
    return lines.length > 0 ? lines[0] : '';
}
