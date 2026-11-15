export interface ParsedArgs {
  command: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
  /** Flags that may repeat, such as --account. */
  multi: Record<string, string[]>;
}

const REPEATABLE = new Set(["account"]);
const BOOLEAN = new Set(["no-open", "json", "remove-folder", "help", "version"]);
const SHORT: Record<string, string> = { h: "help", v: "version" };

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { command: "", positionals: [], flags: {}, multi: {} };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { rest.push(...argv.slice(i + 1)); break; }
    if (a.startsWith("--") && a.length > 2) {
      let name = a.slice(2);
      let value: string | undefined;
      const eq = name.indexOf("=");
      if (eq >= 0) { value = name.slice(eq + 1); name = name.slice(0, eq); }
      if (BOOLEAN.has(name) && value === undefined) { out.flags[name] = true; continue; }
      if (value === undefined) {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith("--")) throw new Error(`Missing value for --${name}`);
        value = next; i++;
      }
      if (REPEATABLE.has(name)) (out.multi[name] ??= []).push(value);
      else out.flags[name] = value;
    } else if (/^-[a-z]$/.test(a) && SHORT[a[1]]) {
      out.flags[SHORT[a[1]]] = true;
    } else rest.push(a);
  }
  if (out.flags.version) out.command = "version";
  else if (out.flags.help) out.command = "help";
  else { out.command = rest[0] ?? "help"; out.positionals = rest.slice(1); }
  return out;
}
