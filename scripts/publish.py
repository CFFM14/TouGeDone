"""Maintainer command: publish an already committed/pushed version to this repo.

Uses existing Git credentials in memory. Never writes or prints credentials.
"""
import json
import os
import re
import subprocess
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen
from package import ROOT, build

API = 'https://api.github.com/repos/CFFM14/TouGeDone'

def make_descriptor(release, tag):
    descriptor = {'format': 1, 'repository': 'CFFM14/TouGeDone', 'tag_name': tag,
                  'draft': False, 'prerelease': False, 'body': release.get('body', ''),
                  'assets': []}
    for asset in release['assets']:
        # Draft assets use an untagged-* URL, which becomes invalid after publication.
        descriptor['assets'].append({key: asset.get(key) for key in ('name', 'state', 'digest')})
        descriptor['assets'][-1]['browser_download_url'] = (
            'https://github.com/CFFM14/TouGeDone/releases/download/'
            + quote(tag, safe='') + '/' + quote(asset['name'], safe=''))
    bundle_asset = next(a for a in descriptor['assets'] if a['name'] == f'TouGeDone-{tag}.bundle.json')
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', str(bundle_asset['digest'])):
        raise RuntimeError('一键更新包缺少 GitHub SHA-256，未发布备用信息。')
    return descriptor

def git(*args, input=None):
    env = {**os.environ, 'GIT_TERMINAL_PROMPT': '0'}
    result = subprocess.run(['git', *args], cwd=ROOT, input=input, text=True,
                            encoding='utf-8', capture_output=True, env=env)
    if result.returncode:
        raise RuntimeError('Git 操作失败，请先确认本机已登录且代码已推送。')
    return result.stdout.strip()

def main():
    if git('status', '--porcelain'):
        raise RuntimeError('工作区尚未提交，请先提交、测试并推送 main。')
    commit = git('rev-parse', 'HEAD')
    if git('remote', 'get-url', 'origin') not in ('https://github.com/CFFM14/TouGeDone.git', 'git@github.com:CFFM14/TouGeDone.git'):
        raise RuntimeError('origin 不是指定的 TouGeDone 仓库，停止发布。')
    remote = git('ls-remote', 'origin', 'refs/heads/main').split()
    if not remote or remote[0] != commit:
        raise RuntimeError('本地 HEAD 与远程 main 不一致，请先推送。')
    version, package, checksum = build()
    tag_refs = git('ls-remote', 'origin', f'refs/tags/v{version}', f'refs/tags/v{version}^{{}}').splitlines()
    if tag_refs and tag_refs[-1].split()[0] != commit:
        raise RuntimeError('同版本标签已指向其他提交，请增加版本号，不覆盖旧发布。')
    result = git('credential', 'fill', input='protocol=https\nhost=github.com\n\n')
    fields = dict(line.split('=', 1) for line in result.splitlines() if '=' in line)
    token = fields.get('password')
    if not token:
        raise RuntimeError('未找到 GitHub 凭据，请先使用 Git 登录。')

    def request(url, data=None, content_type='application/json', method=None):
        headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
                   'User-Agent': 'TouGeDone-release', 'Content-Type': content_type}
        req = Request(url, data=data, headers=headers, method=method)
        with urlopen(req, timeout=90) as response:
            return json.load(response)

    tag = 'v' + version
    label = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8-sig')).get('version_name', tag)
    try:
        release = request(API + '/releases/tags/' + tag)
    except HTTPError as error:
        if error.code != 404:
            raise RuntimeError(f'GitHub 授权或读取失败（HTTP {error.code}）。') from None
        body = {'tag_name': tag, 'target_commitish': commit,
                'name': '天下人苦头歌久矣 ' + label, 'draft': True, 'prerelease': False,
                'body': f'{label}。\n\n下载 `{package.name}`，解压覆盖原加载目录，在 Edge 扩展页重新加载，再刷新答题页。\n\n完整变化见仓库《版本更新记录.md》。2.9.1 起可在设置中授权原插件目录，之后点击“一键更新”。首次升级旧版仍需手动覆盖一次。'}
        release = request(API + '/releases', json.dumps(body, ensure_ascii=False).encode(), method='POST')
    if release.get('target_commitish') not in (commit, 'main'):
        raise RuntimeError('已有同名发布指向其他提交，未覆盖。')
    existing = {asset['name'] for asset in release.get('assets', [])}
    for file in (package, checksum, package.parent / f'TouGeDone-v{version}.bundle.json'):
        if file.name in existing:
            print(f'已存在 {file.name}，保留原附件。')
            continue
        upload = f'https://uploads.github.com/repos/CFFM14/TouGeDone/releases/{release["id"]}/assets?name={quote(file.name)}'
        request(upload, file.read_bytes(), 'application/octet-stream', 'POST')
        print(f'已上传 {file.name}')
    # Publish a small metadata attachment so clients can check without the REST API.
    release = request(API + '/releases/' + str(release['id']))
    descriptor_name = 'TouGeDone-update.json'
    if descriptor_name not in {a['name'] for a in release.get('assets', [])}:
        descriptor = make_descriptor(release, tag)
        upload = f'https://uploads.github.com/repos/CFFM14/TouGeDone/releases/{release["id"]}/assets?name={descriptor_name}'
        request(upload, json.dumps(descriptor, ensure_ascii=False).encode(), 'application/json', 'POST')
        print('已上传 ' + descriptor_name)
    if release.get('draft'):
        release = request(API + '/releases/' + str(release['id']), json.dumps({'draft': False}).encode(), method='PATCH')
    print(release['html_url'])

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Never dump process output, request headers, or a traceback containing credentials.
        if isinstance(error, HTTPError):
            print(f'发布失败：GitHub HTTP {error.code}，请检查仓库写入权限。')
        elif isinstance(error, RuntimeError):
            print('发布失败：' + str(error))
        else:
            print('发布失败：网络、认证或文件操作异常，请检查配置后重试。')
        raise SystemExit(1)
