# 9a3521d 独立证据归档

本目录只归档已有证据，不代表新的独立验收。对象为 `9a3521dda5b559dbacffb842ccbeafd3ad9e7ae4`。第一位非作者视觉报告保持 INCOMPLETE。第二位定向视觉报告对其三个补充项给出 PASS，聚合覆盖见 [实现与验收说明](../../../nova-effect.md)。这些结论针对源运行时，不自动适用于后续提交。

## 来源与完整性

[index.json](index.json) 记录每个文件的原路径、字节数和 SHA-256。文件按原字节复制，未将输出改写为 PASS。

四份 `.log` 是独立数值验收的原始命令输出。`nova17-balance-9a-verify.log` 对应候选版本，`nova17-balance-baseline-verify.log` 对应基线。两份 `nova17-mutation-*.log` 是故障注入后的预期失败输出，用于证明相应断言能捕捉故障。失败日志不代表候选版本失败，也不能改写为成功日志。

两份 `*-transcribed.txt` 明确是验收者对工具输出的转录，不是原始重定向 stdout。配对结果只覆盖所述单一输入机器人和十个种子，不代表人工胜率或浏览器性能。

`runtime-manifest-9a.json` 记录 11 个构建资源的摘要。两个 `served-runtime-*.json` 记录本地服务与该构建的逐文件字节身份检查。它们证明所记录服务资源相同，不代替实际视觉验收。

`remote-final-observation.json` 是主协调于记录时间整理的远程状态观察，不是 GitHub API 原始响应。原始 PR 与 CI 响应留在索引记录的本地来源目录，未将大量账号元数据复制进仓库。该观察记录 PR 为 draft、head 为 9a3521d、CI run 42433738444 为 success，仅适用于该次观察。

## 复核命令

在仓库根目录执行以下命令，逐个复核归档文件与索引一致。

```sh
python3 - <<'PY'
from pathlib import Path
import hashlib, json
root = Path('docs/evidence/nova17/independent-9a')
for item in json.loads((root / 'index.json').read_text())['artifacts']:
    data = (root / item['file']).read_bytes()
    assert len(data) == item['bytes'], item['file']
    assert hashlib.sha256(data).hexdigest() == item['sha256'], item['file']
    print(item['file'], 'matches archived index')
PY
```

后续 docs-only 提交仍须在新 head 上独立核对全部 11 个运行时文件、执行 `npm run verify` 并确认 CI。这里没有新 head 的独立 PASS，也没有合并结论。
