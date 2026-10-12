"""Deploy public YariZan files only; private setup is uploaded manually."""
import base64
import hashlib
import hmac
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import urllib.parse


def run(arguments, **kwargs):
    result = subprocess.run(arguments, capture_output=True, **kwargs)
    if result.returncode:
        # Never include command environments, credentials, or uploaded file contents.
        raise RuntimeError(f"{pathlib.Path(arguments[0]).name} failed ({result.returncode}): "
                           + result.stderr.decode('utf-8', 'replace')[:1200])
    return result.stdout


def required(name):
    value = os.environ.get(name, '')
    if not value:
        raise RuntimeError(f'Missing required secret: {name}')
    return value


def main():
    host = required('FTP_HOST')
    port = int(os.environ.get('FTP_PORT') or '21')
    if not re.fullmatch(r'[A-Za-z0-9.-]+', host) or not 1 <= port <= 65535:
        raise RuntimeError('FTP hostname or port is invalid.')
    expected = re.sub(r'[:\s]', '', required('FTP_CERT_FINGERPRINT')).lower()
    if len(expected) not in (40, 64) or not re.fullmatch(r'[a-f0-9]+', expected):
        raise RuntimeError('FTP_CERT_FINGERPRINT must be a SHA-256 or SHA-1 certificate fingerprint.')
    with tempfile.TemporaryDirectory(prefix='yarizan-deploy-') as temp:
        directory = pathlib.Path(temp)
        # Inspect the certificate before authenticating. No FTP password is sent here.
        handshake = subprocess.run(['openssl', 's_client', '-connect', f'{host}:{port}',
                                    '-servername', host, '-starttls', 'ftp', '-showcerts'],
                                   input=b'', capture_output=True, timeout=30)
        match = re.search(rb'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----',
                          handshake.stdout, re.S)
        if not match:
            raise RuntimeError('Cannot obtain the FTPS server certificate.')
        cert = directory / 'server.pem'
        cert.write_bytes(match[0] + b'\n')
        cert_der = run(['openssl', 'x509', '-in', str(cert), '-outform', 'DER'])
        actual = (hashlib.sha256 if len(expected) == 64 else hashlib.sha1)(cert_der).hexdigest()
        if not hmac.compare_digest(expected, actual):
            raise RuntimeError('FTPS certificate fingerprint mismatch. No credentials were sent.')
        public_pem = run(['openssl', 'x509', '-in', str(cert), '-pubkey', '-noout'])
        public_der = run(['openssl', 'pkey', '-pubin', '-outform', 'DER'], input=public_pem)
        pin = 'sha256//' + base64.b64encode(hashlib.sha256(public_der).digest()).decode()
        netrc = directory / 'credentials.netrc'
        def quoted(value):
            if any(c in value for c in '\r\n\0'):
                raise RuntimeError('FTP credentials contain unsupported control characters.')
            return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'
        netrc.write_text(f'machine {host}\nlogin {quoted(required("FTP_USERNAME"))}\n'
                         f'password {quoted(required("FTP_PASSWORD"))}\n', encoding='utf-8')
        netrc.chmod(0o600)
        # Public-key pinning is enforced on EVERY actual control/data TLS connection.
        # curl's pin verification remains active with --insecure; the exact peer key
        # from the independently fingerprint-verified certificate is mandatory.
        curl = ['curl', '--fail', '--silent', '--show-error', '--ssl-reqd', '--insecure',
                '--pinnedpubkey', pin, '--netrc-file', str(netrc), '--connect-timeout', '15',
                '--max-time', '120', '--ftp-pasv']
        base_url = f'ftp://{host}:{port}/'
        def url(path):
            return base_url + urllib.parse.quote(path.lstrip('/'), safe='/')
        def listing(path):
            result = subprocess.run(curl + ['--list-only', url(path.rstrip('/') + '/')], capture_output=True)
            if result.returncode:
                return None
            return {line.strip().rstrip('/').rsplit('/', 1)[-1]
                    for line in result.stdout.decode('utf-8', 'replace').splitlines()}
        public_root = None
        for candidate in ('yarizan', 'domains/osameh.dev/subdomains/yarizan', 'subdomains/yarizan'):
            names = listing(candidate)
            if names is not None:
                public_root = candidate
                break
        if public_root is None:
            names = listing('')
            if names is None:
                raise RuntimeError('Cannot access FTP account root. Nothing was uploaded.')
            if {'domains', 'private', 'subdomains', 'public_html'}.intersection(names):
                raise RuntimeError('FTP root appears to be an account parent. Scope it to the yarizan document root. Nothing was uploaded.')
            # The dedicated FTP account may already be rooted at the document root.
            public_root = ''
        if '--preflight' in sys.argv:
            print(f'FTPS identity and public root verified: {public_root or "account root"}')
            return
        artifact = pathlib.Path('licensing-dist')
        def upload(local, destination):
            if '..' in pathlib.PurePosixPath(destination).parts:
                raise RuntimeError('Unsafe deployment path.')
            temporary = '.' + pathlib.PurePosixPath(destination).name + '.upload-' + os.environ.get('GITHUB_SHA', 'manual')[:12]
            target_directory = str(pathlib.PurePosixPath(destination).parent)
            staged = target_directory + '/' + temporary
            run(curl + ['--ftp-create-dirs', '--upload-file', str(local),
                        '--quote', '-RNFR ' + temporary,
                        '--quote', '-RNTO ' + pathlib.PurePosixPath(destination).name,
                        url(staged)])
        public_files = [p for p in (artifact / 'public').rglob('*') if p.is_file()]
        public_files.sort(key=lambda p: (p.name == 'index.php', p.as_posix()))
        for local in public_files:
            destination = '/'.join(part for part in (public_root, local.relative_to(artifact / 'public').as_posix()) if part)
            upload(local, destination)
        print('Public panel files deployed. No private files were accessed, uploaded, or changed.')



if __name__ == '__main__':
    main()
