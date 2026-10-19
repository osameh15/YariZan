"""Normalize local math-page filenames; dry run unless --apply is supplied."""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

SMALL = ['', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم', 'یازدهم', 'دوازدهم', 'سیزدهم', 'چهاردهم', 'پانزدهم', 'شانزدهم', 'هفدهم', 'هجدهم', 'نوزدهم']
TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود']
ROUND = ['', '', 'بیستم', 'سی‌ام', 'چهلم', 'پنجاهم', 'شصتم', 'هفتادم', 'هشتادم', 'نودم']
HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد']


def ordinal(n):
    if n < 20:
        return SMALL[n]
    if n < 100:
        return ROUND[n // 10] if n % 10 == 0 else TENS[n // 10] + ' و ' + ('یکم' if n % 10 == 1 else SMALL[n % 10])
    return HUNDREDS[n // 100] + ('م' if n % 100 == 0 else ' و ' + ('یکم' if n % 100 == 1 else ordinal(n % 100)))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--grade', type=int, choices=range(1, 7), default=1)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    folder = root / 'miniApps' / str(args.grade)
    numbers = {ordinal(n): n for n in range(1, 1000)}
    numbers.update({'هشتاد و یک': 81, 'صد و نوزده': 119})
    games = []
    print('Inspecting source filenames...', flush=True)
    for exe in sorted(folder.glob('*.exe')):
        english = re.fullmatch(r'page(\d+)(?:[_-](\d+))?', exe.stem)
        persian = re.fullmatch(r'صفحه (.+?) کتاب ریاضی(?:\s*-\s*(.+))?', exe.stem)
        if english:
            page, suffix = int(english[1]), ''
            if english[2]:
                suffix = 'بازی ' + ordinal(int(english[2]))
        elif persian:
            page = int(persian[1]) if persian[1].isdigit() else numbers[persian[1]]
            suffix = persian[2] or ''
        else:
            raise ValueError(f'Unrecognized game name: {exe.name}')
        games.append([exe, page, suffix, bool(english)])
    plan = []
    for exe, page, suffix, english in games:
        siblings = [g for g in games if g[1] == page]
        if len(siblings) > 1 and not suffix:
            suffix = 'بازی دوم' if english else 'بازی اول'
            if page == 119:
                suffix = 'تفریق با محور'
        if page == 119 and suffix in ('جمع', 'جمع اعداد'):
            suffix = 'جمع با محور'
        elif page == 119 and suffix in ('تفریق', 'تفریق اعداد'):
            suffix = 'تفریق با محور'
        elif suffix == 'جمع':
            suffix = 'جمع اعداد'
        elif suffix == 'تفریق':
            suffix = 'تفریق اعداد'
        title = f'صفحه {page} کتاب ریاضی' + (f' - {suffix}' if suffix else '')
        for ext in ('.exe', '.jpg', '.png', '.txt'):
            source = exe.with_suffix(ext)
            # The original page81_2 executable uses page81-2 sidecars.
            if not source.exists() and english:
                source = folder / (exe.stem.replace('_', '-') + ext)
            if not source.exists():
                continue
            target = folder / (title + ext)
            if source == target:
                continue
            if target.exists():
                raise ValueError(f'Destination exists: {target.name}')
            print('Checking ' + source.name, flush=True)
            plan.append({'old': source.name, 'new': target.name,
                         'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
    if len({p['new'] for p in plan}) != len(plan):
        raise ValueError('Duplicate destinations; no files changed')
    if args.apply and plan:
        backup = root / 'publish' / f'math-numeric-renames-g{args.grade}.json'
        backup.parent.mkdir(exist_ok=True)
        if backup.exists():
            raise ValueError(f'Preserve existing rename record before proceeding: {backup}')
        backup.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding='utf-8')
        for item in plan:
            source, target = folder / item['old'], folder / item['new']
            source.rename(target)
            if hashlib.sha256(target.read_bytes()).hexdigest() != item['sha256']:
                raise ValueError(f'Content changed: {target.name}')
    print(f'{len(games)} games; {len(plan)} files ' + ('renamed and hash-verified.' if args.apply else 'to rename (dry run).'))
    for item in plan:
        print(item['old'] + ' -> ' + item['new'])


if __name__ == '__main__':
    main()
