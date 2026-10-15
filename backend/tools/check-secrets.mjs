import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve("..");
const files = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
let checked = 0;
for (const file of files) {
  if (!file.startsWith("backend/") && !file.startsWith("tests/BackendInterop/"))
    continue;
  if (/(?:^|\/)(?:\.env$|\.local\/)|\.pem$/.test(file))
    throw new Error("Tracked secret path: " + file);
  const text = readFileSync(path.join(root, file), "utf8");
  if (
    /-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----|(?:gh[pousr]_[A-Za-z0-9]{30,})/.test(
      text,
    )
  )
    throw new Error("Tracked private material: " + file);
  checked++;
}
console.log(
  `Backend secret scan: ${checked} tracked files checked; no private-key blocks or token patterns`,
);
