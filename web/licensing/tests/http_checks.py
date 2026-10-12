"""End-to-end checks against the disposable localhost preview only."""
import http.cookiejar
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("YARIZAN_TEST_URL", "http://127.0.0.1:8871")
parsed = urllib.parse.urlparse(BASE)
if parsed.scheme != 'http' or parsed.hostname != '127.0.0.1' or not parsed.port:
    raise RuntimeError('HTTP tests may only mutate a disposable localhost service.')
cookies = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(cookies))

def request(path, data=None, json_body=False):
    headers = {}
    if json_body:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    elif data is not None:
        body = urllib.parse.urlencode(data).encode()
    else:
        body = None
    try:
        response = client.open(urllib.request.Request(BASE + path, body, headers), timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    return response.status, response.read().decode("utf-8"), response.headers

def check(ok, label):
    assert ok, label
    print("PASS:", label)

def csrf(html):
    return re.search(r'name="csrf" value="([a-f0-9]+)"', html)[1]

status, html, headers = request("/")
check(status == 200 and 'name="password"' in html and 'trial_used' not in html, "Unauthenticated users see login only")
check("no-store" in headers.get("Cache-Control", ""), "Panel is not cacheable")
check("frame-ancestors 'none'" in headers.get("Content-Security-Policy", ""), "Panel cannot be framed")
status, _, _ = request("/", {"action": "issue", "csrf": "invalid", "hwid": "A" * 64})
check(status == 403, "Forged admin POST rejected")
status, html, _ = request("/", {"action": "login", "csrf": csrf(html), "username": "admin", "password": "Local-test-password-2026"})
check(status == 200 and 'name="action" value="logout"' in html, "Administrator login works")
token = csrf(html)
status, html, _ = request("/", {"action": "issue", "csrf": token, "hwid": "A" * 64, "customer_name": "<script>bad</script>", "notes": "Test customer"})
check(status == 200 and "&lt;script&gt;bad&lt;/script&gt;" in html and "<script>bad</script>" not in html, "Customer details escaped")
serial = re.search(r'<code dir="ltr">([A-Z2-7-]+)</code>', html)[1]
check(len(serial.replace("-", "")) == 103, "Panel generates a compatible serial")
check(html.index('</table>') < html.index('id="device-editor"'), "Editor appears after user table")
check('aria-label="بستن بخش ویرایش"' in html, "Editor has an accessible close action")
status, html, _ = request("/", {"action": "save", "csrf": token, "hwid": "A" * 64,
                              "customer_name": "Renamed customer", "notes": "Unique support description"})
check(status == 200 and serial in html and 'Renamed customer' in html, "Editing metadata preserves serial")
for term, label in [("Renamed customer", "name"), ("Unique support description", "description"), ("A" * 64, "HWID"), (serial, "serial")]:
    status, html, _ = request('/?q=' + urllib.parse.quote(term))
    check(status == 200 and serial in html, 'Search finds user by ' + label)
status, html, _ = request('/')
check('id="device-editor"' not in html, "Editor is closed on normal table view")
status, health, _ = request("/api/health.php")
check(status == 200 and json.loads(health)["status"] == "ready", "Health endpoint reports readiness")
status, _, _ = request("/api/trial.php")
check(status == 405, "Trial endpoint refuses GET")
status, _, _ = request("/api/trial.php", {"hwid": "A" * 64})
check(status == 415, "Trial endpoint requires JSON")
status, _, _ = request("/api/trial.php", {"operation": "consume", "hwid": "Z" * 64, "nonce": "B" * 64}, True)
check(status == 400, "Invalid device identity rejected")
status, registered, _ = request('/api/trial.php', {'operation': 'status', 'hwid': 'E' * 64, 'pc_name': 'Registration-only PC'}, True)
check(status == 200 and json.loads(registered)['remaining'] == 2, 'First-run registration does not spend a trial')
status, html, _ = request('/?q=Registration-only%20PC')
check(status == 200 and 'E' * 64 in html, 'Registered PC appears in admin table before trial starts')
request("/", {"action": "reset_trial", "csrf": token, "hwid": "A" * 64})
one = {"operation": "consume", "hwid": "A" * 64, "nonce": "B" * 64}
status, grant, headers = request("/api/trial.php", one, True)
check(status == 200 and json.loads(grant)["remaining"] == 1 and "signature" in json.loads(grant), "First signed trial entry")
check("no-store" in headers.get("Cache-Control", ""), "Trial response is not cacheable")
status, retry, _ = request("/api/trial.php", one, True)
check(status == 200 and json.loads(retry) == json.loads(grant), "Network retry does not consume another entry")
status, grant, _ = request("/api/trial.php", dict(one, nonce="C" * 64), True)
check(status == 200 and json.loads(grant)["remaining"] == 0, "Second signed trial entry")
status, _, _ = request("/api/trial.php", dict(one, nonce="D" * 64), True)
check(status == 403, "Third entry denied")
request("/", {"action": "reset_trial", "csrf": token, "hwid": "A" * 64})
status, data, _ = request("/api/trial.php", {"operation": "status", "hwid": "A" * 64}, True)
check(status == 200 and json.loads(data)["remaining"] == 2, "Panel reset restores two entries")
status, html, _ = request("/?q=AAAA")
check(status == 200 and serial in html, "User and serial searchable; reset preserves serial")
status, html, _ = request("/", {"action": "logout", "csrf": token})
check(status == 200 and 'name="password"' in html, "Logout removes panel access")
