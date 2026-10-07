#!/usr/bin/env python3
"""Walks the Urdu screens of the installed app on an Android emulator and saves screenshots.

Used by .github/workflows/phone-check.yml. Controls are found by their testID, which Android
exposes as the view's resource-id.
"""
import re
import subprocess
import sys
import time
from pathlib import Path

APK, OUT = sys.argv[1], Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
PACKAGE = 'com.billkul.app'
NODE = re.compile(r'<node [^>]*?>')
ATTR = re.compile(r'([\w-]+)="([^"]*)"')
count = 0
freezes = 0
LOG = open(OUT / 'log.txt', 'w', encoding='utf-8')


def say(*parts):
    line = ' '.join(str(p) for p in parts)
    print(line, flush=True)
    LOG.write(line + '\n')
    LOG.flush()


def adb(*args, check=False, timeout=120):
    return subprocess.run(['adb', *args], capture_output=True, timeout=timeout, check=check)


def nodes():
    for _ in range(4):
        xml = adb('exec-out', 'uiautomator', 'dump', '/dev/tty').stdout.decode('utf-8', 'replace')
        if '<hierarchy' in xml:
            return [dict(ATTR.findall(n)) for n in NODE.findall(xml)]
        say('   screen could not be read:', xml.strip()[:160])
        time.sleep(1)
    return []


def find(test_id):
    """Centre of the control with this testID. A trailing * matches any testID that starts with the rest."""
    prefix = test_id[:-1] if test_id.endswith('*') else None
    for n in nodes():
        rid = n.get('resource-id', '')
        if rid == test_id or (prefix is not None and rid.startswith(prefix)):
            m = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', n.get('bounds', ''))
            if m:
                x1, y1, x2, y2 = map(int, m.groups())
                if x2 > x1 and y2 > y1:
                    return (x1 + x2) // 2, (y1 + y2) // 2
    return None


def tap(test_id, wait=20, pause=1.2):
    end = time.time() + wait
    while time.time() < end:
        spot = find(test_id)
        if spot:
            adb('shell', 'input', 'tap', str(spot[0]), str(spot[1]))
            time.sleep(pause)
            return True
        time.sleep(1)
    say(f'!! not found: {test_id}')
    return False


def focus():
    out = adb('shell', 'dumpsys', 'window').stdout.decode('utf-8', 'replace')
    m = re.search(r'mCurrentFocus=.*', out)
    return m.group(0) if m else '?'


def frozen():
    return 'Not Responding' in focus()


def collect_freeze(name):
    """Saves what Android recorded about a freeze: the stuck threads and the recent log."""
    adb('root')
    time.sleep(4)
    newest = adb('shell', 'ls -t /data/anr | head -1').stdout.decode().strip()
    say('freeze record:', newest or 'none')
    if newest:
        trace = adb('shell', f'cat /data/anr/{newest}').stdout.decode('utf-8', 'replace')
        (OUT / f'{name}-threads.txt').write_text('\n'.join(trace.splitlines()[:900]), encoding='utf-8')
    log = adb('logcat', '-d', '-t', '900', '*:W').stdout.decode('utf-8', 'replace')
    (OUT / f'{name}-log.txt').write_text(log, encoding='utf-8')


def restart():
    adb('shell', 'am', 'force-stop', PACKAGE)
    time.sleep(1)
    adb('shell', 'am', 'start', '-n', f'{PACKAGE}/.MainActivity')
    time.sleep(8)


def to_tabs():
    """Leaves whatever is open and returns to the screens with the bottom tabs."""
    for _ in range(5):
        if frozen():
            say('!! the app froze; restarting it')
            global freezes
            freezes += 1
            if freezes == 1:
                shot('frozen')
                collect_freeze('freeze')
            restart()
        if find('tab-Home'):
            return True
        if PACKAGE not in focus():
            adb('shell', 'input', 'keyevent', 'HOME')
            time.sleep(1)
            adb('shell', 'am', 'start', '-n', f'{PACKAGE}/.MainActivity')
            time.sleep(3)
            continue
        if not (tap('sheet-close', wait=1) or tap('back', wait=1)):
            back()
    say(f'!! could not get back to the tabs: {focus()}')
    return False


def shot(name):
    global count
    count += 1
    path = OUT / f'{count:02d}-{name}.png'
    path.write_bytes(adb('exec-out', 'screencap', '-p').stdout)
    say(f'saved {path.name}')


def back():
    adb('shell', 'input', 'keyevent', 'BACK')
    time.sleep(1)


def text(value):
    adb('shell', 'input', 'text', value)
    time.sleep(0.8)


def swipe_up():
    adb('shell', 'input', 'swipe', '540', '1700', '540', '700', '300')
    time.sleep(1)


say(adb('install', '-r', APK, timeout=300).stdout.decode().strip())
say(adb('shell', 'getprop', 'ro.build.version.release').stdout.decode().strip(), adb('shell', 'wm', 'size').stdout.decode().strip())
# A freshly started emulator sometimes ignores the first launch.
for attempt in range(4):
    adb('shell', 'am', 'start', '-n', f'{PACKAGE}/.MainActivity')
    time.sleep(12)
    if PACKAGE in focus():
        break
    say('the app did not come to the front; trying again:', focus())
# Sign-in comes first. This build carries its own stand-in server (EXPO_PUBLIC_FAKE_SERVER=1), which
# accepts the code 123456 for any number.
shot('signin-en')
tap('lang-ur', wait=60)
shot('signin-ur')
if tap('signin-number'):
    text('3001234567')
    back()
    shot('signin-number')
    tap('signin-send', pause=3)
    shot('signin-code')
    if tap('signin-code', wait=8):
        text('123456')
        time.sleep(3)
shot('setup-ur')
if not tap('setup-skip', wait=5):
    swipe_up()
    tap('setup-skip')
time.sleep(2)
shot('home')

# First the screens as a new shop sees them: every label, no data needed.
tap('tab-Documents')
shot('empty-documents-quotes')
tap('tab-invoices')
shot('empty-documents-invoices')
tap('tab-Cash')
shot('empty-cash')
if tap('cash-print', pause=6):
    shot('empty-cash-report')
    tap('report-side-all', pause=3)
    shot('empty-cash-report-both')
    say('report screen:', focus())
    to_tabs()
if tap('money-in'):
    shot('empty-cash-form')
    to_tabs()
tap('tab-Home')

# An invoice with one line, sent and marked paid, so lists and reports have rows.
if tap('new-invoice'):
    shot('editor-empty')
    if tap('item-search'):
        text('Fan')
        tap('item-add-new')
        back()
        if tap('price-0'):
            text('4500')
            back()
    shot('editor')
    if tap('preview', pause=5):
        shot('preview')
        started = time.time()
        seen = nodes()
        say(f'preview: {len(seen)} controls read in {time.time() - started:.1f}s;', focus())
        if tap('open-receipt', wait=5, pause=6):
            shot('receipt')
            web = adb('logcat', '-d', '-t', '1500').stdout.decode('utf-8', 'replace')
            keep = [l for l in web.splitlines() if re.search(r'chromium|WebView|cr_|[Rr]enderer|RNCWeb|ReactNativeJS', l)]
            (OUT / 'receipt-web-log.txt').write_text('\n'.join(keep[-250:]), encoding='utf-8')
            tap('receipt-58', wait=3, pause=3)
            shot('receipt-58')
            tap('sheet-close', wait=3)
        # Sending marks the invoice as sent; the share menu itself is not needed.
        if tap('send-image', wait=5, pause=4):
            say('after send-image:', focus())
            # Keep the picture that was handed to the share menu, to check it is not blank.
            adb('root')
            time.sleep(4)
            made = adb('shell', f'ls -t /data/data/{PACKAGE}/cache/*.png /data/user/0/{PACKAGE}/cache/*/*.png 2>/dev/null | head -1').stdout.decode().strip()
            say('shared picture:', made or 'not found')
            if made:
                (OUT / 'shared-image.png').write_bytes(adb('exec-out', 'cat', made).stdout)
            adb('shell', 'input', 'keyevent', 'HOME')
            time.sleep(1)
            adb('shell', 'am', 'start', '-n', f'{PACKAGE}/.MainActivity')
            time.sleep(3)
            if PACKAGE not in focus():
                back()
        swipe_up()
        tap('mark-paid', wait=6)
        shot('preview-paid')
to_tabs()

tap('tab-Home')
shot('home-data')
tap('tab-Documents')
shot('documents-quotes')
tap('tab-invoices')
shot('documents-invoices')
tap('tab-Cash')
shot('cash')
if tap('money-out'):
    text('1200')
    shot('cash-form')
    back()
    tap('cash-save', wait=5)
    time.sleep(1)
to_tabs()
shot('cash-entries')
tap('cash-expenses')
shot('cash-expenses')
tap('cash-sales')
shot('cash-sales')
if tap('sales-on-*', wait=4):
    shot('cash-sales-day')
if tap('cash-print', pause=5):
    shot('cash-report')
    tap('report-side-out', pause=4)
    shot('cash-report-out')
to_tabs()
tap('tab-Customers')
shot('customers')
tap('tab-Items')
shot('items')
tap('tab-Home')
if tap('home-due'):
    shot('due')
to_tabs()
if tap('home-profit'):
    shot('sales')
    if tap('sales-on-*', wait=4):
        shot('sales-day')
        back()
        time.sleep(1)
        say('PHONE BACK BUTTON returns to day by day:', find('sales-on-*') is not None)
to_tabs()
if tap('open-settings'):
    shot('settings')
    back()
    time.sleep(1)
    say('PHONE BACK BUTTON leaves Settings:', find('tab-Home') is not None, focus())
    to_tabs()
    tap('open-settings')
    swipe_up()
    shot('settings-lower')
to_tabs()
say('done')
