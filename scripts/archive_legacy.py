"""Recover original legacy ZIPs as explicit historical snapshots, without checkout.

--prepare creates local archive tags/branch and verifies every Git blob byte-for-byte.
Push those refs, then use --publish to attach the original ZIPs to archival releases.
Nothing changes the current extension, latest release, or existing release assets.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
API = 'https://api.github.com/repos/CFFM14/TouGeDone'
BRANCH = 'archive/early-versions'
VERSIONS = {
    '1.1.0': ('走进真实浏览器', '接入 Edge 调试，识别真实选项与评测记录；当时仍主要处理一道多选题。'),
    '1.1.3': ('第一题通过', '修正选项点击、空组合和通过结果识别，留下实际完成第一关第一题的记录。'),
    '1.2.0': ('减少记录页刷新', '加入页面网络桥读取正常评测记录；最小提交间隔默认1秒，仍等待本次最终结果。'),
    '2.0.0': ('从一道题到一整关', '自动识别整关单选、多选，支持整关/指定题、基线与最佳答案；当时尚未自动跨关。'),
    '2.1.0': ('自动进入下一关', '通过后自动跨关，选择题模式跳过编程关；多选从多选项到少选项尝试。'),
    '2.2.0': ('DeepSeek 与三种模式', '加入选择题、编程题、混合模式，支持 DeepSeek 生成、写入当前文件和恢复；当时尚未自动评测循环。'),
}
DEST = ROOT / 'dist' / 'legacy'
INDEX = DEST / 'archive-index.json'


def git(*args, data=None, allow_missing=False):
    env = {**os.environ, 'GIT_TERMINAL_PROMPT': '0'}
    env.pop('GIT_AUTHOR_DATE', None)
    env.pop('GIT_COMMITTER_DATE', None)
    result = subprocess.run(['git', *args], cwd=ROOT, input=data, capture_output=True, env=env)
    if result.returncode and not allow_missing:
        raise RuntimeError('Git archive operation failed: ' + args[0])
    return result.stdout


def checked_zip(version):
    path = ROOT.parent / f'educoder-edge-helper-{version}.zip'
    files = {}
    with ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise RuntimeError('ZIP CRC check failed')
        for entry in archive.infolist():
            # The six selected original packages have flat layouts.
            name = entry.filename
            if entry.is_dir() or '/' in name or '\\' in name or name in ('.', '..') or name in files:
                raise RuntimeError('Unexpected or duplicate original archive path')
            if entry.file_size > 1_000_000 or '.local.' in name or name.startswith('.'):
                raise RuntimeError('Unexpected private or oversized archive entry')
            content = archive.read(name)
            if re.search(rb'sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----', content):
                raise RuntimeError('Possible credential in archive; publication stopped')
            files[name] = content
    manifest = json.loads(files['manifest.json'].decode('utf-8-sig'))
    if manifest['version'] != version:
        raise RuntimeError('Archive manifest version mismatch')
    required = {manifest['background']['service_worker']}
    required.update(p for script in manifest.get('content_scripts', []) for p in script['js'])
    if manifest.get('options_page'):
        required.add(manifest['options_page'])
    if not required.issubset(files):
        raise RuntimeError('Original archive is missing a runtime dependency')
    return path, files


def prepare():
    DEST.mkdir(parents=True, exist_ok=True)
    records, parent = [], None
    for version in VERSIONS:
        source, files = checked_zip(version)
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        entries = []
        for name, content in sorted(files.items()):
            blob = git('hash-object', '-w', '--stdin', data=content).decode().strip()
            if git('cat-file', 'blob', blob) != content:
                raise RuntimeError('Recovered source bytes changed')
            entries.append(f'100644 blob {blob}\t'.encode() + name.encode('utf-8') + b'\0')
        tree = git('mktree', '-z', data=b''.join(entries)).decode().strip()
        tag = 'v' + version
        existing = git('rev-parse', '--verify', f'refs/tags/{tag}^{{commit}}', allow_missing=True).decode().strip()
        if existing:
            if git('rev-parse', existing + '^{tree}').decode().strip() != tree:
                raise RuntimeError('Existing historical tag differs; never overwrite tags')
            commit = existing
        else:
            message = (f'archive: recover {tag} from original ZIP\n\n'
                       f'Archive date: 2026-11-20. This is a recovered snapshot, not the original development commit.\n'
                       f'Original package: {source.name}\nSHA-256: {digest}\n')
            args = ['commit-tree', tree]
            if parent:
                args.extend(['-p', parent])
            commit = git(*args, data=message.encode()).decode().strip()
            git('tag', '-a', tag, commit, '-F', '-', data=message.encode())
        folder = DEST / tag
        folder.mkdir(exist_ok=True)
        shutil.copyfile(source, folder / source.name)
        checksum = folder / (source.name + '.sha256')
        checksum.write_text(f'{digest}  {source.name}\n', encoding='ascii')
        records.append({'version': version, 'tag': tag, 'commit': commit, 'tree': tree,
                        'filename': source.name, 'sha256': digest, 'files': len(files)})
        parent = commit
        print(tag + ': original package and source snapshot verified')
    old = git('rev-parse', '--verify', 'refs/heads/' + BRANCH, allow_missing=True).decode().strip()
    if old and old != parent:
        raise RuntimeError('Existing archive branch differs; not overwritten')
    if not old:
        git('update-ref', 'refs/heads/' + BRANCH, parent, '0' * 40)
    INDEX.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def publish():
    if git('remote', 'get-url', 'origin').decode().strip() != 'https://github.com/CFFM14/TouGeDone.git':
        raise RuntimeError('Unexpected repository')
    records = json.loads(INDEX.read_text(encoding='utf-8'))
    credentials = git('credential', 'fill', data=b'protocol=https\nhost=github.com\n\n').decode()
    fields = dict(line.split('=', 1) for line in credentials.splitlines() if '=' in line)
    token = fields.get('password')
    if not token:
        raise RuntimeError('GitHub credentials unavailable')

    def request(url, data=None, method=None, content_type='application/json'):
        req = Request(url, data=data, method=method, headers={
            'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
            'Content-Type': content_type, 'User-Agent': 'TouGeDone-history-archive'})
        with urlopen(req, timeout=60) as response:
            return json.load(response)

    latest = request(API + '/releases/latest')['tag_name']
    for item in records:
        version, tag = item['version'], item['tag']
        remote = git('ls-remote', 'origin', f'refs/tags/{tag}^{{}}').decode().split()
        if not remote or remote[0] != item['commit']:
            raise RuntimeError('Historical source tag has not been pushed')
        source, _ = checked_zip(version)
        if hashlib.sha256(source.read_bytes()).hexdigest() != item['sha256']:
            raise RuntimeError('Original ZIP changed after verification')
        title, summary = VERSIONS[version]
        body = (f'## {tag} · {title}\n\n{summary}\n\n'
                f'归档于2026-11-20。附件 `{item["filename"]}` 是当时留存的原 ZIP，未重新打包；附有 SHA-256 校验文件。'
                '对应标签由包内原始文件逐字节重建，提交日期是本次归档日期，不冒充当年的开发提交。\n\n'
                '本条是历史纪念归档。Pre-release 标记用于排除当前正式版更新通道；不影响最新正式版本。'
                '旧版按当时的平台开发，日常使用请安装最新正式版。\n\n'
                '[远古版本纪念录](https://github.com/CFFM14/TouGeDone/blob/main/远古版本纪念录.md) · '
                '[最新正式版](https://github.com/CFFM14/TouGeDone/releases/latest)\n\n'
                f'原包 SHA-256：`{item["sha256"]}`\n')
        try:
            release = request(API + '/releases/tags/' + tag)
        except HTTPError as error:
            if error.code != 404:
                raise
            release = request(API + '/releases', json.dumps({
                'tag_name': tag, 'target_commitish': item['commit'],
                'name': f'{tag} · {title} · 历史归档', 'body': body,
                'draft': True, 'prerelease': True, 'make_latest': 'false'
            }, ensure_ascii=False).encode(), 'POST')
        if release['target_commitish'] != item['commit'] or not release['prerelease']:
            raise RuntimeError('Existing release is not this archival snapshot')
        assets = {a['name']: a for a in release.get('assets', [])}
        for filename in (item['filename'], item['filename'] + '.sha256'):
            file = DEST / tag / filename
            content = file.read_bytes()
            if filename == item['filename'] and hashlib.sha256(content).hexdigest() != item['sha256']:
                raise RuntimeError('Staged ZIP differs from the original verified package')
            digest = 'sha256:' + hashlib.sha256(content).hexdigest()
            if filename in assets:
                if assets[filename].get('digest') != digest:
                    raise RuntimeError('Existing archive attachment differs; not overwritten')
                continue
            url = f'https://uploads.github.com/repos/CFFM14/TouGeDone/releases/{release["id"]}/assets?name={quote(filename)}'
            request(url, content, 'POST', 'application/octet-stream')
        if release['draft']:
            request(API + '/releases/' + str(release['id']),
                    json.dumps({'draft': False, 'prerelease': True, 'make_latest': 'false'}).encode(), 'PATCH')
        print(tag + ': original ZIP and checksum published as historical archive')
    if request(API + '/releases/latest')['tag_name'] != latest:
        raise RuntimeError('Latest release changed; check release settings')
    print('Latest stable release remains ' + latest)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--prepare', action='store_true')
    group.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    try:
        prepare() if args.prepare else publish()
    except Exception as error:
        # Do not print request headers, Git credential output or a token-bearing traceback.
        if isinstance(error, HTTPError):
            print('Archive operation failed: GitHub HTTP ' + str(error.code))
        elif isinstance(error, RuntimeError):
            print('Archive operation stopped: ' + str(error))
        else:
            print('Archive operation failed: file, Git or network error')
        raise SystemExit(1)
