#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
git_docs_commit.py —— 文档仓库 plumbing 提交脚本（2026-08-08）

背景：本环境（WorkBuddy 沙箱）对 .git/refs/ 与 .git/logs/ 持续拒写（目录级写保护），
`git commit` 的 ref 更新步骤必失败。绕行方案：git plumbing 三步拆解——
  write-tree ✅ → commit-tree ✅（commit object 写入 objects）→ update-ref ❌（被保护）
commit object 完整写入仓库后，由**用户本机**执行 `git update-ref refs/heads/main <hash>` 收尾。

用法：python scripts/git_docs_commit.py [-m "提交信息"]
  （默认先 git add -A 暂存全部文档变更）
"""
import argparse
import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GIT = ['git', '-C', ROOT, '-c', 'core.quotepath=false']


def run(*args, check=True):
    r = subprocess.run(GIT + list(args), capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f'[错误] git {" ".join(args)} 失败:\n{r.stderr.strip()}', file=sys.stderr)
        sys.exit(1)
    return r.stdout.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-m', '--message', default='docs: 文档体系更新', help='提交信息')
    args = ap.parse_args()

    # 1. 暂存
    run('add', '-A')
    staged = run('diff', '--cached', '--name-only')
    if not staged:
        print('[提示] 无暂存变更，跳过提交')
        return
    n = len(staged.splitlines())
    print(f'[1/3] 已暂存 {n} 个文件')

    # 2. write-tree
    tree = run('write-tree')
    print(f'[2/3] write-tree → {tree}')

    # 3. commit-tree（已有 main 分支 commit 则链上 parent）
    parents = []
    has_main = subprocess.run(GIT + ['show-ref', '--verify', '--quiet', 'refs/heads/main'], capture_output=True).returncode == 0
    if has_main:
        parents = ['-p', run('rev-parse', 'refs/heads/main')]
    msg = args.message
    commit = run('commit-tree', tree, *parents, '-m', msg)
    print(f'[3/3] commit-tree → {commit}')

    # 4. 尝试 update-ref（本环境预期失败，输出收尾命令）
    r = subprocess.run(GIT + ['update-ref', 'refs/heads/main', commit], capture_output=True, text=True)
    if r.returncode == 0:
        print(f'[完成] refs/heads/main 已更新 → {commit}')
    else:
        print()
        print('[待收尾] 本环境 ref 写保护，请在本机终端执行：')
        print(f'  git -C "{ROOT}" update-ref refs/heads/main {commit}')
        print(f'  git -C "{ROOT}" status  # 应显示 clean')
        print(f'  git -C "{ROOT}" log --oneline')


if __name__ == '__main__':
    main()
