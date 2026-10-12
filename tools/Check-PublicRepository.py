"""Reject accidentally tracked private runtime files before building/deploying."""
import pathlib
import re
import subprocess

paths = subprocess.check_output(['git', 'ls-files', '-z']).decode('utf-8').split('\0')
for name in filter(None, paths):
    path = pathlib.PurePosixPath(name)
    if 'private' in path.parts or path.name in {'private.pem', 'master.key', 'admin-credentials.txt', '.env', 'config.php'}:
        raise SystemExit('Private runtime file is tracked: ' + name)
    if path.suffix in {'.pem', '.key', '.php', '.json', '.txt'}:
        file = pathlib.Path(name)
        if file.is_file() and re.search(rb'^-----BEGIN (?:EC |RSA )?PRIVATE KEY-----', file.read_bytes(), re.M):
            raise SystemExit('Private signing key content is tracked: ' + name)
print('PASS: no private runtime files or signing keys are tracked.')
