/**
 * Cross-platform `KEY=value command` (Windows PowerShell has no inline env).
 * Usage: node scripts/run-with-env.mjs KEY=value [KEY2=value] -- command args...
 * Used so the owner's real app builds into its own folder (.next-prod) and
 * test/dev builds (.next) can never overwrite the files it is serving.
 */
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const sep = args.indexOf("--");
if (sep < 1 || sep === args.length - 1) {
  console.error("usage: node scripts/run-with-env.mjs KEY=value -- command [args]");
  process.exit(2);
}
const env = { ...process.env };
for (const pair of args.slice(0, sep)) {
  const i = pair.indexOf("=");
  if (i < 1) {
    console.error(`bad env pair: ${pair}`);
    process.exit(2);
  }
  env[pair.slice(0, i)] = pair.slice(i + 1);
}
const [cmd, ...rest] = args.slice(sep + 1);
const child = spawn(cmd, rest, { env, stdio: "inherit", shell: true });
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
