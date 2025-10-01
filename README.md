
# FF14 Skills Scraper

FF14公式サイトからスキルデータを自動取得するスクレイピングツールです。

## 🚀 機能

- **単一ジョブ取得**: 指定したジョブのスキルデータを取得
- **全ジョブ一括取得**: 全てのFF14ジョブのスキルデータを一括取得
- **JSON形式出力**: 構造化されたJSONファイルでデータを保存
- **GitHub Actions対応**: 自動化されたデータ更新

## 📦 インストール

```bash
cd scripts
npm install
```

## 🎯 使用方法

### 単一ジョブの取得

```bash
# パラディンのスキルデータを取得
node scrape_ff14_skills.js --job paladin --verbose

# 出力ディレクトリを指定
node scrape_ff14_skills.js --job warrior --output ../data --verbose
```

### 全ジョブの一括取得

```bash
# 全ジョブのスキルデータを取得
node scrape_all_jobs.js --verbose

# 特定のジョブのみ取得
node scrape_all_jobs.js --jobs "paladin,warrior,white_mage" --verbose

# リクエスト間隔を指定（デフォルト: 2000ms）
node scrape_all_jobs.js --delay 5000 --verbose
```

### テスト実行

```bash
# 設定確認とテスト実行
node test_scraper.js
```

## 📋 対応ジョブ

### タンク
- `paladin` - ナイト
- `warrior` - 戦士
- `dark_knight` - 暗黒騎士
- `gunbreaker` - ガンブレイカー

### ヒーラー
- `white_mage` - 白魔道士
- `scholar` - 学者
- `astrologian` - 占星術師
- `sage` - 賢者

### DPS
#### 近接DPS
- `dragoon` - 竜騎士
- `monk` - モンク
- `ninja` - 忍者
- `samurai` - 侍
- `reaper` - リーパー
- `viper` - ヴァイパー

#### 遠隔DPS
- `bard` - 吟遊詩人
- `machinist` - 機工士
- `dancer` - 踊り子

#### 魔法DPS
- `black_mage` - 黒魔道士
- `summoner` - 召喚士
- `red_mage` - 赤魔道士
- `blue_mage` - 青魔道士

## 📄 出力データ形式

### 個別ジョブファイル（例: `paladin_skills.json`）

```json
{
  "metadata": {
    "job_name": "paladin",
    "job_display_name": "ナイト",
    "job_role": "tank",
    "source_url": "https://jp.finalfantasyxiv.com/jobguide/paladin/",
    "scraped_at": "2024-01-01T12:00:00.000Z",
    "scraper_version": "1.0.0",
    "total_skills": 25
  },
  "skills": [
    {
      "id": "paladin_skill_1",
      "name": "ファストブレード",
      "description": "対象に物理攻撃。威力：200",
      "level": 1,
      "job_role": "tank",
      "skill_type": "weaponskill",
      "cooldown": 0,
      "cast_time": 0,
      "recast_time": 250,
      "icon_url": "https://...",
      "source_url": "https://jp.finalfantasyxiv.com/jobguide/paladin/",
      "scraped_at": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

### 統合ファイル（`all_ff14_skills.json`）

```json
{
  "metadata": {
    "total_jobs": 19,
    "total_skills": 400,
    "scraped_at": "2024-01-01T12:00:00.000Z",
    "scraper_version": "1.0.0",
    "jobs": [...] 
  },
  "skills_by_job": {
    "paladin": {...},
    "warrior": {...}
  },
  "all_skills": [...]
}
```

## ⚙️ GitHub Actions

### 単一ジョブ更新
- ワークフロー: `.github/workflows/update-ff14-skills.yml`
- 手動実行: Actions タブから「Update FF14 Skills Data」を実行
- 定期実行: 毎週日曜日 0時

### 全ジョブ一括更新  
- ワークフロー: `.github/workflows/update-all-ff14-skills.yml`
- 手動実行: Actions タブから「Update All FF14 Skills Data」を実行
- 定期実行: 毎月1日 0時

## 🔧 設定

### コマンドラインオプション

#### `scrape_ff14_skills.js`
- `-j, --job <job>`: ジョブ名（デフォルト: paladin）
- `-o, --output <path>`: 出力ディレクトリ（デフォルト: data）
- `-v, --verbose`: 詳細ログ出力

#### `scrape_all_jobs.js`
- `-o, --output <path>`: 出力ディレクトリ（デフォルト: data）
- `-v, --verbose`: 詳細ログ出力
- `-j, --jobs <jobs>`: カンマ区切りジョブ名（空の場合は全ジョブ）
- `--delay <ms>`: リクエスト間隔（デフォルト: 2000ms）

## 🚨 注意事項

1. **レート制限**: FF14公式サイトへの負荷を避けるため、リクエスト間隔を適切に設定してください
2. **利用規約**: FF14公式サイトの利用規約を遵守してください
3. **データ精度**: スクレイピングデータは公式サイトの構造変更により影響を受ける可能性があります

## 📝 ライセンス

MIT License