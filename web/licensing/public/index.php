<?php
declare(strict_types=1);
require __DIR__ . '/app-loader.php';
startAdminSession($config);
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    checkCsrf();
    $action = $_POST['action'] ?? '';
    if ($action === 'login') {
        $ipAllowed = rateLimit($db, 'login-ip|' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 10, 900);
        $accountAllowed = rateLimit($db, 'login-account|' . $config['admin_username'], 50, 900);
        $username = is_string($_POST['username'] ?? null) ? $_POST['username'] : '';
        $password = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';
        $validPassword = password_verify($password, $config['admin_password_hash']);
        if ($ipAllowed && $accountAllowed && hash_equals($config['admin_username'], $username) && $validPassword) {
            session_regenerate_id(true);
            $_SESSION['admin'] = $username;
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            header('Location: /', true, 303); exit;
        }
        $error = $ipAllowed && $accountAllowed ? 'نام کاربری یا رمز عبور نادرست است.' : 'تلاش‌های ورود بیش از حد است. ۱۵ دقیقه بعد دوباره امتحان کنید.';
    } elseif (isset($_SESSION['admin'])) {
        if ($action === 'logout') {
            $_SESSION = []; session_destroy();
            header('Location: /', true, 303); exit;
        }
        try {
            if (!is_string($_POST['hwid'] ?? null)) throw new InvalidArgumentException('HWID is required.');
            $hwid = YariZan\Licensing\Crypto::hwid($_POST['hwid']);
            if ($action === 'issue' || $action === 'save') {
                $name = $_POST['customer_name'] ?? '';
                $notes = $_POST['notes'] ?? '';
                if (!is_string($name) || !is_string($notes)) throw new InvalidArgumentException('Invalid customer details.');
                if ($action === 'save') {
                    $service->update($hwid, trim($name), trim($notes), $_SESSION['admin']);
                    $_SESSION['flash'] = ['message' => 'اطلاعات کاربر ذخیره شد.'];
                } else {
                $serial = $service->issue($hwid, trim($name), trim($notes), $_SESSION['admin']);
                $_SESSION['flash'] = ['message' => 'سریال آماده است؛ آن را برای کاربر ارسال کنید.', 'serial' => $serial, 'hwid' => $hwid];
            }
            } elseif ($action === 'reset_trial') {
                $service->resetTrial($hwid, $_SESSION['admin']);
                $_SESSION['flash'] = ['message' => 'آزمایش این دستگاه بازنشانی شد؛ کاربر دوباره ۲ ورود آزمایشی دارد.'];
            } else {
                throw new InvalidArgumentException('Unknown action.');
            }
            header('Location: /?' . http_build_query(['edit' => $hwid, 'q' => is_string($_POST['q'] ?? null) ? $_POST['q'] : '', 'per_page' => (int)($_POST['per_page'] ?? 25), 'page' => (int)($_POST['page'] ?? 1)]) . '#device-editor', true, 303); exit;
        } catch (InvalidArgumentException $exception) {
            $error = $exception->getMessage();
        }
    } else {
        http_response_code(403);
        $error = 'ابتدا وارد پنل شوید.';
    }
}
$loggedIn = isset($_SESSION['admin']);
$csrf = escape($_SESSION['csrf']);
$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);
$search = is_string($_GET['q'] ?? null) ? trim(substr($_GET['q'], 0, 600)) : '';
$page = max(1, min(100000, (int)($_GET['page'] ?? 1)));
$pageSizes = [10, 25, 50, 100, 200];
$requestedSize = filter_var($_GET['per_page'] ?? $_SESSION['per_page'] ?? 25, FILTER_VALIDATE_INT);
$perPage = in_array($requestedSize, $pageSizes, true) ? $requestedSize : 25;
$pageCount = 1;
$devices = []; $total = 0; $issued = 0;
if ($loggedIn) {
    $pattern = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search) . '%';
    $where = " WHERE hwid LIKE ? ESCAPE '!' OR customer_name LIKE ? ESCAPE '!' OR notes LIKE ? ESCAPE '!' OR serial LIKE ? ESCAPE '!'";
    $stmt = $db->prepare('SELECT COUNT(*) FROM devices' . $where);
    $stmt->execute([$pattern, $pattern, $pattern, $pattern]); $total = (int)$stmt->fetchColumn();
    $_SESSION['per_page'] = $perPage;
    $pageCount = max(1, (int)ceil($total / $perPage));
    $page = min($page, $pageCount);
    $issued = (int)$db->query('SELECT COUNT(*) FROM devices WHERE serial IS NOT NULL')->fetchColumn();
    $offset = ($page - 1) * $perPage;
    $stmt = $db->prepare('SELECT * FROM devices' . $where . " ORDER BY created_at DESC, hwid LIMIT $perPage OFFSET $offset");
    $stmt->execute([$pattern, $pattern, $pattern, $pattern]); $devices = $stmt->fetchAll();
}
$listQuery = http_build_query(['q' => $search, 'per_page' => $perPage, 'page' => $page]);
$editor = null;
$newDevice = $loggedIn && isset($_GET['new']);
if ($loggedIn && is_string($_GET['edit'] ?? null)) {
    try {
        $editHwid = YariZan\Licensing\Crypto::hwid($_GET['edit']);
        $stmt = $db->prepare('SELECT * FROM devices WHERE hwid = ?');
        $stmt->execute([$editHwid]);
        $editor = $stmt->fetch() ?: null;
        if (!$editor) $error = 'دستگاه پیدا نشد.';
    } catch (InvalidArgumentException) { $error = 'شناسهٔ دستگاه نامعتبر است.'; }
}
if ($loggedIn && $error !== '' && is_string($_POST['hwid'] ?? null) && in_array($_POST['action'] ?? '', ['save', 'issue'], true)) {
    if (!$editor && ($_POST['action'] ?? '') === 'issue') $newDevice = true;
    $editor ??= ['hwid' => $_POST['hwid'], 'serial' => null];
    $editor['customer_name'] = is_string($_POST['customer_name'] ?? null) ? $_POST['customer_name'] : '';
    $editor['notes'] = is_string($_POST['notes'] ?? null) ? $_POST['notes'] : '';
}

?>
<!doctype html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>یاریزان | مدیریت فعال‌سازی</title><link rel="icon" type="image/png" href="/assets/icon.png?v=1"><link rel="stylesheet" href="/assets/panel.css?v=6"><script src="/assets/panel.js?v=4" defer></script></head>
<body class="<?= $loggedIn ? 'panel-page' : 'login-page' ?>"><div class="shell">
<?php if ($loggedIn): ?>
<header class="topbar"><a class="brand" href="/"><img class="brand-logo" src="/assets/logo.png?v=1" alt="" width="72" height="72"><span class="brand-copy"><strong>یاریزان</strong><small>مدیریت فعال‌سازی</small></span></a>
<form method="post"><input type="hidden" name="csrf" value="<?= $csrf ?>"><input type="hidden" name="action" value="logout"><button class="quiet" type="submit">خروج از پنل</button></form></header>
<?php endif; ?>
<?php if ($error !== ''): ?><p class="notice error" role="alert"><?= escape($error) ?></p><?php endif; ?>
<?php if (!$loggedIn): ?>
<main class="login card"><img class="login-logo" src="/assets/logo.png?v=1" alt="نشان یاریزان" width="160" height="160"><p class="eyebrow">پنل مدیر</p><h1>خوش آمدید</h1><p class="muted">برای مدیریت کاربران و سریال‌های یاریزان وارد شوید.</p><form method="post">
<input type="hidden" name="csrf" value="<?= $csrf ?>"><input type="hidden" name="action" value="login">
<label for="username">نام کاربری</label><input id="username" name="username" dir="ltr" autocomplete="username" required maxlength="120">
<label for="password">رمز عبور</label><input id="password" name="password" type="password" dir="ltr" autocomplete="current-password" required maxlength="1024">
<button type="submit">ورود به پنل</button></form></main>
<?php else: ?>
<main><div class="heading"><div><p class="eyebrow">فعال‌سازی دستگاه‌ها</p><h1>کاربران و سریال‌ها</h1><p class="muted">سریال هر کاربر برای همان شناسهٔ دستگاه معتبر می‌ماند.</p></div><div class="stat"><strong><?= persianDigits($issued) ?></strong><span>دستگاه دارای سریال</span></div></div>
<?php if ($flash): ?><section class="notice" role="status"><p><?= escape($flash['message']) ?></p><?php if (isset($flash['serial'])): ?><code dir="ltr"><?= escape($flash['serial']) ?></code><button type="button" class="quiet" data-copy="<?= escape($flash['serial']) ?>">کپی سریال</button><?php endif; ?></section><?php endif; ?>
<section class="card"><div class="list-toolbar"><h2>کاربران و دستگاه‌ها</h2><a class="button-link" href="?<?= escape($listQuery) ?>&amp;new=1#device-editor">افزودن با HWID</a></div><div class="list-head"><div><h2>دستگاه‌های ثبت‌شده</h2><p class="muted">دستگاه‌های آزمایشی و کاربران دارای سریال، <?= persianDigits($total) ?> نتیجه</p></div><form method="get" class="search"><label class="sr-only" for="q">جست‌وجوی نام، توضیحات، سریال یا شناسه</label><input id="q" name="q" value="<?= escape($search) ?>" placeholder="نام، توضیحات، سریال یا HWID"><label for="per_page" class="page-size-label">نمایش در هر صفحه</label><div class="page-size-control"><select id="per_page" name="per_page"><?php foreach ($pageSizes as $size): ?><option value="<?= $size ?>"<?= $size === $perPage ? ' selected' : '' ?>><?= persianDigits($size) ?></option><?php endforeach; ?></select></div><button type="submit" class="quiet">جست‌وجو</button></form></div>
<div class="table-wrap"><table><thead><tr><th>کاربر و دستگاه</th><th>سریال فعال‌سازی</th><th>آزمایش</th><th>عملیات</th></tr></thead><tbody>
<?php foreach ($devices as $device): ?><tr><td><strong><?= escape($device['customer_name'] ?: 'بدون نام') ?></strong><code class="hwid" dir="ltr"><?= escape($device['hwid']) ?></code><button class="text-button" type="button" data-copy="<?= escape($device['hwid']) ?>">کپی شناسه</button><?php if ($device['notes'] !== ''): ?><p class="muted small"><?= escape($device['notes']) ?></p><?php endif; ?><p class="muted small">ثبت: <time class="persian-date" dir="ltr" datetime="<?= escape(str_replace(' ', 'T', $device['created_at']) . 'Z') ?>">—</time></p></td>
<td><?php if ($device['serial']): ?><span class="badge">سریال صادر شده</span><code class="serial" dir="ltr"><?= escape($device['serial']) ?></code><button class="text-button" type="button" data-copy="<?= escape($device['serial']) ?>">کپی سریال</button><?php else: ?><span class="muted">هنوز صادر نشده</span><?php endif; ?></td>
<td><strong><?= persianDigits(max(0, 2 - (int)$device['trial_used'])) ?> از ۲</strong><p class="muted small">ورود باقی‌مانده</p></td><td><div class="row-actions"><a class="button-link quiet" href="?<?= escape($listQuery) ?>&amp;edit=<?= escape($device['hwid']) ?>#device-editor">ویرایش و سریال</a><form method="post" data-confirm="آزمایش این دستگاه به ۲ ورود بازنشانی شود؟"><input type="hidden" name="csrf" value="<?= $csrf ?>"><input type="hidden" name="action" value="reset_trial"><input type="hidden" name="hwid" value="<?= escape($device['hwid']) ?>"><button class="quiet" type="submit">بازنشانی آزمایش</button></form></div></td></tr><?php endforeach; ?>
<?php if (!$devices): ?><tr><td colspan="4" class="empty">دستگاهی پیدا نشد. برای ثبت دستی، «افزودن با HWID» را انتخاب کنید.</td></tr><?php endif; ?>
</tbody></table></div><nav class="pagination" aria-label="صفحه‌های کاربران"><?php if ($page > 1): ?><a href="?q=<?= escape(urlencode($search)) ?>&amp;per_page=<?= $perPage ?>&amp;page=<?= $page - 1 ?>">صفحهٔ قبل</a><?php endif; ?><span>صفحهٔ <?= persianDigits($page) ?> از <?= persianDigits($pageCount) ?></span><?php if ($page < $pageCount): ?><a href="?q=<?= escape(urlencode($search)) ?>&amp;per_page=<?= $perPage ?>&amp;page=<?= $page + 1 ?>">صفحهٔ بعد</a><?php endif; ?></nav></section>

<?php if ($editor || $newDevice): ?>
<section class="card device-editor" id="device-editor" aria-labelledby="editor-title" tabindex="-1">
<div class="editor-head"><div><p class="eyebrow"><?= $editor ? 'جزئیات دستگاه' : 'ثبت دستی' ?></p><h2 id="editor-title"><?= $editor ? 'ویرایش کاربر و سریال' : 'افزودن دستگاه با HWID' ?></h2><p class="muted">نام و توضیحات قابل ویرایش است؛ سریال صادرشده ثابت می‌ماند.</p></div><a class="close-editor" href="?<?= escape($listQuery) ?>" aria-label="بستن بخش ویرایش">بستن ×</a></div>
<form method="post"><input type="hidden" name="csrf" value="<?= $csrf ?>">
<input type="hidden" name="q" value="<?= escape($search) ?>"><input type="hidden" name="per_page" value="<?= $perPage ?>"><input type="hidden" name="page" value="<?= $page ?>">
<div class="fields"><div><label for="customer_name">نام کاربر / رایانه</label><input id="customer_name" name="customer_name" maxlength="120" value="<?= escape($editor['customer_name'] ?? '') ?>" autocomplete="off"></div><div><label for="hwid">شناسهٔ دستگاه (HWID)</label><input id="hwid" name="hwid" class="mono" dir="ltr" maxlength="100" required spellcheck="false" value="<?= escape($editor['hwid'] ?? '') ?>"<?= $editor && !$newDevice ? ' readonly' : '' ?> placeholder="64 hexadecimal characters"></div></div>
<label for="notes">توضیحات و اطلاعات تماس</label><textarea id="notes" name="notes" maxlength="1000" rows="3" placeholder="اطلاعاتی که برای پیدا کردن و پشتیبانی کاربر نیاز دارید"><?= escape($editor['notes'] ?? '') ?></textarea>
<?php if (!empty($editor['serial'])): ?><div class="serial-detail"><span class="badge">سریال صادرشده</span><code dir="ltr"><?= escape($editor['serial']) ?></code><button type="button" class="quiet" data-copy="<?= escape($editor['serial']) ?>">کپی سریال</button></div><?php else: ?><p class="muted small">هنوز سریالی صادر نشده است. ذخیرهٔ اطلاعات، سریال تولید نمی‌کند.</p><?php endif; ?>
<div class="editor-actions"><?php if ($editor && !$newDevice): ?><button type="submit" name="action" value="save">ذخیرهٔ تغییرات</button><?php endif; ?><?php if (empty($editor['serial'])): ?><button type="submit" name="action" value="issue" class="<?= $editor ? 'quiet' : '' ?>">صدور و ذخیرهٔ سریال</button><?php endif; ?><a href="?<?= escape($listQuery) ?>">بستن</a></div></form></section>
<?php endif; ?>
<p class="footnote">کاربر با نصب دوبارهٔ ویندوز می‌تواند سریال قبلی را وارد کند، به شرط ثابت ماندن HWID. صدور سریال به معنای اطلاع از فعال بودن فعلی برنامه نیست؛ نسخهٔ فعال‌شده آفلاین کار می‌کند.</p>
</main><?php endif; ?><div id="copy-status" role="status" aria-live="polite"></div></div></body></html>
