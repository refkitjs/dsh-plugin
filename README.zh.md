# @refkit/dsh-plugin

[English](README.md) | 中文

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）插件，封装了 [refkit](https://github.com/refkitjs/refkit) 参考搜索库：将经过许可证归一化处理的创意素材搜索能力，变成原生 agent 工具，并配有网页卡片，在每条结果上展示许可证与使用判定。

- **`refkit_search`** — 一次调用即可扇出到多达 23 个来源(Openverse、Met、Art Institute of Chicago、Wikimedia Commons、Rijksmuseum、Smithsonian、Internet Archive、Project Gutenberg、PoetryDB、Poly Haven、ambientCG、Europeana、Unsplash、Pexels、Pixabay、Flickr、Freesound、Jamendo、Brave、nailbook),合并并重新排序结果,并为每条结果返回其许可证 id、canonical 链接,以及——当你传入 `intent` 时——使用判定和一条可直接使用的署名文本。
- **`refkit_rights`** — 针对不同的使用意图重新校验同一条许可证,无需重新搜索。
- **网页卡片** — 缩略图网格;每个卡片都带许可证标签;绿 / 蓝 / 红 / 黄四色徽章分别对应 allowed(允许) / credit required(需署名) / not allowed(不允许) / needs review(需人工复核);一键复制署名文本。

十一个来源无需任何密钥即可使用（Openverse、Met、Art Institute of Chicago、Wikimedia Commons、Rijksmuseum、Internet Archive、Project Gutenberg、PoetryDB、Poly Haven、ambientCG、nailbook）。其余来源在「插件（侧边栏）→ @refkit/dsh-plugin → refkit → 配置」里填入免费密钥即可启用。

## 安装

```sh
dsh plugin --profile web add @refkit/dsh-plugin
# 或直接从 GitHub 安装(预构建的产物已提交到仓库):
dsh plugin --profile web add github:refkitjs/dsh-plugin
```

重启一次 dsh web host,让该 profile 加载该 bundle。已在 `@deepseek-ai/dsh` 0.1.7-rc.2 上测试通过;要求 dsh ≥ 0.1.7-rc.2(更低版本 dsh 会拒绝加载该插件)。

## 配置

密钥和调优参数在「插件（侧边栏）→ @refkit/dsh-plugin → refkit → 配置」中设置(命名空间为 `refkit`);修改在下一次调用时生效,无需重启。所有 key 字段都是 `secret` 类型:在卡片中会被遮罩显示,不会被记录日志,也不会返回给模型,并以明文形式存储在该 profile 的 `cordis.patch.yml` 中(文件权限 0600)。某个 key 留空时会回退读取对应的 `REFKIT_*` 环境变量——与 `@refkit/mcp` 读取的变量名相同,因此同一份 `.env` 可以同时服务这两者。手动编辑后校验失败的 `cordis.patch.yml` 会导致插件在启动时停止运行,直到修复为止。

| 字段 | 环境变量(先匹配者优先) | 启用的来源 |
| --- | --- | --- |
| `unsplashAccessKey` | `REFKIT_UNSPLASH_KEY`, `UNSPLASH_KEY` | unsplash |
| `pexelsApiKey` | `REFKIT_PEXELS_KEY`, `PEXELS_KEY` | pexels, pexels-video |
| `pixabayKey` | `REFKIT_PIXABAY_KEY`, `PIXABAY_KEY` | pixabay, pixabay-video |
| `flickrApiKey` | `REFKIT_FLICKR_KEY`, `FLICKR_KEY` | flickr |
| `smithsonianApiKey` | `REFKIT_SMITHSONIAN_KEY`, `SI_KEY` | smithsonian |
| `braveToken` | `REFKIT_BRAVE_KEY`, `BRAVE_TOKEN` | brave |
| `freesoundToken` | `REFKIT_FREESOUND_KEY`, `FREESOUND_TOKEN` | freesound |
| `jamendoClientId` | `REFKIT_JAMENDO_CLIENT_ID`, `JAMENDO_CLIENT_ID` | jamendo |
| `europeanaApiKey` | `REFKIT_EUROPEANA_KEY`, `EUROPEANA_KEY` | europeana |
| `openverseToken` | `REFKIT_OPENVERSE_TOKEN` | 提升 Openverse 速率限制(可选) |

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `sources` | `[]` | 要启用的来源 id;为空 = 启用所有已配置 key 的来源 |
| `limit` | `12` | 每次调用默认返回的结果数(1–30);也限制 met、rijksmuseum、polyhaven 的逐条详情拉取数量 |
| `poolFactor` | `2` | 排序融合(rank-fusion)的候选池倍数(1–4) |
| `deadlineMs` | `15000` | 整次搜索的截止时间 |
| `timeoutMs` | `10000` | 单个来源的超时时间 |
| `rerank` | `true` | 对 title、description、tags 和 excerpt 做词法重排序(支持 CJK) |
| `sourceConfidence` | `true` | 对结果批次中完全没有提及查询词的来源降权 |
| `userAgent` | `refkit-dsh-plugin/<version>` | 随请求发送给各来源的 User-Agent |

## 工具

### `refkit_search`

| 参数 | 类型 | 含义 |
| --- | --- | --- |
| `query` | string | 要搜索的内容 |
| `modalities` | `image` `video` `audio` `text` | 默认 `["image"]` |
| `intent` | `internal-moodboard` `commercial-product` `ai-generation-input` `redistribution` | 为每条结果附加使用判定和署名文本 |
| `gateFor` | 同上 | 仅返回许可证允许该用途的结果 |
| `sources` | string[] | 限定到特定的来源 id |
| `limit` | 1–30 | 默认取自配置 |
| `cursor` | string | 沿用上一次结果里的 `nextCursor` 继续翻页 |
| `controls` | object | orientation、color、language、sort、safety、license、media、creator、text、page |
| `minRelevance` | 0–1 | 丢弃重排序分数低于该值的结果 |
| `explain` | boolean | 在 `meta` 下附带每个来源的诊断信息 |

示例提示词:“find me reference photos of brutalist libraries I can use in a commercial pitch deck”、“给我找几张可以商用的赛博朋克街景参考图”、“a public-domain poem about the sea for a poster”。

### `refkit_rights`

必填:`license`、`intent`、`canonicalUrl`;可选:`licenseVersion`、`author`、`title`、`editorialOnly`、`jurisdiction`、`userJurisdiction`、`facts`。返回 `decision`、`reasons`、`confidence`、`attribution`、`disclaimer`。

## 开发

```sh
pnpm install
pnpm test                 # vitest,进程内运行,无需网络
pnpm build                # lib/index.js(host 半)+ lib/client.js(browser 半)+ lib/types
node scripts/check-client-bundle.mjs
REFKIT_LIVE=1 node scripts/smoke-host.mjs "forest path"   # 一次真实的 Openverse 搜索
dsh plugin --profile web add file:$PWD                    # 安装本地构建产物
```

`lib/` 目录已提交到仓库,因此 `github:` 方式安装无需额外构建;若该目录与源码不一致,CI 会失败。

## 非法律意见

判定结果是基于来源声明的许可证事实所做的保守启发式推断。它们说明的是来源允许你做什么,并不构成权利审查(rights clearance)。

## License

Apache-2.0
