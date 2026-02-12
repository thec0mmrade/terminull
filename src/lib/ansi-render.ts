import AnsiUp from 'ansi_up';

const ansi_up = new AnsiUp();
ansi_up.use_classes = false;

export function ansiToHtml(ansiText: string): string {
  return ansi_up.ansi_to_html(ansiText);
}
