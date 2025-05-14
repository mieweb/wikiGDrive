const FG_DEFAULT = '\u001b[39m';
const FG_RED = '\u001b[31m';
const FG_GREEN = '\u001b[32m';
const FG_GRAY = '\u001b[90m';

export const ansi_colors = {
  gray(str: string) {
    return FG_GRAY + str + FG_DEFAULT;
  },
  green(str: string) {
    return FG_GREEN + str + FG_DEFAULT;
  },
  red(str: string) {
    return FG_RED + str + FG_DEFAULT;
  }
};
