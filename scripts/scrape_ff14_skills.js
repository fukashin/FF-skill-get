#!/usr/bin/env node

/**
 * FF14公式サイトからスキルデータを取得するスクレイパー
 * Usage: node scripts/scrape_ff14_skills.js --job paladin
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');

// コマンドライン引数の設定
program
  .option('-j, --job <job>', 'FF14 job name', 'paladin')
  .option('-o, --output <path>', 'Output directory', 'data')
  .option('-v, --verbose', 'Verbose output')
  .parse();

const options = program.opts();

// FF14ジョブと役職のマッピング
const JOB_MAPPINGS = {
  // タンク
  'paladin': { role: 'tank', url_name: 'paladin', display_name: 'ナイト' },
  'warrior': { role: 'tank', url_name: 'warrior', display_name: '戦士' },
  'dark_knight': { role: 'tank', url_name: 'darkknight', display_name: '暗黒騎士' },
  'gunbreaker': { role: 'tank', url_name: 'gunbreaker', display_name: 'ガンブレイカー' },
  
  // ヒーラー
  'white_mage': { role: 'healer', url_name: 'whitemage', display_name: '白魔道士' },
  'scholar': { role: 'healer', url_name: 'scholar', display_name: '学者' },
  'astrologian': { role: 'healer', url_name: 'astrologian', display_name: '占星術師' },
  'sage': { role: 'healer', url_name: 'sage', display_name: '賢者' },
  
  // DPS
  'black_mage': { role: 'magical_dps', url_name: 'blackmage', display_name: '黒魔道士' },
  'summoner': { role: 'magical_dps', url_name: 'summoner', display_name: '召喚士' },
  'red_mage': { role: 'magical_dps', url_name: 'redmage', display_name: '赤魔道士' },
  'blue_mage': { role: 'magical_dps', url_name: 'bluemage', display_name: '青魔道士' },
  
  'dragoon': { role: 'melee_dps', url_name: 'dragoon', display_name: '竜騎士' },
  'monk': { role: 'melee_dps', url_name: 'monk', display_name: 'モンク' },
  'ninja': { role: 'melee_dps', url_name: 'ninja', display_name: '忍者' },
  'samurai': { role: 'melee_dps', url_name: 'samurai', display_name: '侍' },
  'reaper': { role: 'melee_dps', url_name: 'reaper', display_name: 'リーパー' },
  'viper': { role: 'melee_dps', url_name: 'viper', display_name: 'ヴァイパー' },
  
  'bard': { role: 'ranged_dps', url_name: 'bard', display_name: '吟遊詩人' },
  'machinist': { role: 'ranged_dps', url_name: 'machinist', display_name: '機工士' },
  'dancer': { role: 'ranged_dps', url_name: 'dancer', display_name: '踊り子' }
};

/**
 * スキル種類を判定する
 */
function determineSkillType(skillData) {
  const classification = skillData.classification || '';
  
  // 分類から直接判定
  if (classification.includes('ウェポンスキル')) {
    return 'weaponskill';
  }
  
  if (classification.includes('魔法')) {
    return 'spell';
  }
  
  if (classification.includes('アビリティ')) {
    return 'ability';
  }
  
  if (classification.includes('特性')) {
    return 'trait';
  }
  
  // リミットブレイク
  if (skillData.name.includes('リミット') || skillData.name.includes('limit')) {
    return 'limit_break';
  }
  
  // デフォルト（分類がない場合はアビリティとする）
  return 'ability';
}

/**
 * クールタイムとキャスト時間を解析
 */
function parseSkillTiming(castTimeText, recastTimeText) {
  const result = {
    cast_time: 0,     // キャスト時間（0.01秒単位）
    recast_time: 0    // リキャスト時間（0.01秒単位）
  };
  
  // キャスト時間の解析
  if (castTimeText && castTimeText !== 'Instant') {
    const castMatch = castTimeText.match(/(\d+(?:\.\d+)?)\s*秒/);
    if (castMatch) {
      result.cast_time = Math.round(parseFloat(castMatch[1]) * 100);
    }
  }
  
  // リキャスト時間の解析
  if (recastTimeText) {
    const recastMatch = recastTimeText.match(/(\d+(?:\.\d+)?)\s*秒/);
    if (recastMatch) {
      result.recast_time = Math.round(parseFloat(recastMatch[1]) * 100);
    }
  }
  
  return result;
}

/**
 * FF14公式サイトからスキルデータを取得
 */
async function scrapeFF14Skills(jobName) {
  const jobInfo = JOB_MAPPINGS[jobName];
  if (!jobInfo) {
    throw new Error(`Unknown job: ${jobName}. Available jobs: ${Object.keys(JOB_MAPPINGS).join(', ')}`);
  }
  
  const url = `https://jp.finalfantasyxiv.com/jobguide/${jobInfo.url_name}/`;
  
  if (options.verbose) {
    console.log(`🔍 Scraping FF14 skills for ${jobInfo.display_name} from: ${url}`);
  }
  
  // Puppeteerでブラウザを起動
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // ユーザーエージェントを設定
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // ページを読み込み
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // スキル情報を抽出
    const skills = await page.evaluate((jobRole, jobName) => {
      // PvEアクションのテーブル行を取得
      const skillRows = document.querySelectorAll('tr[id*="pve_action"]');
      const extractedSkills = [];
      
      skillRows.forEach((row, index) => {
        try {
          // スキル名を取得
          const nameEl = row.querySelector('td.skill strong');
          const skillName = nameEl ? nameEl.textContent.trim() : '';
          
          if (!skillName || skillName === '') return;
          
          // レベル情報を取得
          const levelEl = row.querySelector('td.jobclass p');
          const levelText = levelEl ? levelEl.textContent.trim() : '';
          const levelMatch = levelText.match(/Lv(\d+)/);
          const level = levelMatch ? parseInt(levelMatch[1]) : 1;
          
          // スキルタイプを取得
          const classificationEl = row.querySelector('td.classification');
          const classification = classificationEl ? classificationEl.textContent.trim().replace(/\s+/g, '') : '';
          
          // キャスト時間を取得
          const castEl = row.querySelector('td.cast');
          const castTime = castEl ? castEl.textContent.trim() : '';
          
          // リキャスト時間を取得
          const recastEl = row.querySelector('td.recast');
          const recastTime = recastEl ? recastEl.textContent.trim() : '';
          
          // コスト情報を取得
          const costEl = row.querySelector('td.cost');
          const cost = costEl ? costEl.textContent.trim() : '';
          
          // スキル説明を取得（最後のtd要素）
          const allTds = row.querySelectorAll('td');
          const descriptionEl = allTds[allTds.length - 1];
          const description = descriptionEl ? descriptionEl.textContent.trim() : '';
          
          // アイコンURL取得
          const iconEl = row.querySelector('td.skill img');
          const iconUrl = iconEl ? iconEl.src : '';
          
          extractedSkills.push({
            name: skillName,
            description: description,
            level: level,
            classification: classification,
            cast_time_text: castTime,
            recast_time_text: recastTime,
            cost: cost,
            icon_url: iconUrl,
            job_role: jobRole,
            job_name: jobName
          });
        } catch (error) {
          console.error('Error processing skill row:', error);
        }
      });
      
      return extractedSkills;
    }, jobInfo.role, jobName);
    
    if (options.verbose) {
      console.log(`📊 Found ${skills.length} skills for ${jobInfo.display_name}`);
    }
    
    // スキルデータを整形
    const processedSkills = skills.map((skill, index) => {
      const timing = parseSkillTiming(skill.cast_time_text, skill.recast_time_text);
      const skillType = determineSkillType(skill);
      
      return {
        id: `${jobName}_skill_${index + 1}`,
        name: skill.name,
        description: skill.description,
        level: skill.level,
        job_role: skill.job_role,
        skill_type: skillType,
        classification: skill.classification,
        cast_time: timing.cast_time,
        recast_time: timing.recast_time,
        cost: skill.cost,
        icon_url: skill.icon_url,
        source_url: url,
        scraped_at: new Date().toISOString()
      };
    });
    
    // メタデータを含むJSONを作成
    const skillData = {
      metadata: {
        job_name: jobName,
        job_display_name: jobInfo.display_name,
        job_role: jobInfo.role,
        source_url: url,
        scraped_at: new Date().toISOString(),
        scraper_version: '1.0.0',
        total_skills: processedSkills.length
      },
      skills: processedSkills
    };
    
    return skillData;
    
  } finally {
    await browser.close();
  }
}

/**
 * JSONファイルを保存
 */
async function saveSkillData(skillData, jobName) {
  const outputDir = path.resolve(options.output);
  const outputPath = path.join(outputDir, `${jobName}_skills.json`);
  
  // 出力ディレクトリを作成
  await fs.mkdir(outputDir, { recursive: true });
  
  // JSONファイルを保存
  await fs.writeFile(outputPath, JSON.stringify(skillData, null, 2), 'utf8');
  
  if (options.verbose) {
    console.log(`💾 Skill data saved to: ${outputPath}`);
    console.log(`📊 Total skills: ${skillData.skills.length}`);
  }
  
  return outputPath;
}

/**
 * メイン実行関数
 */
async function main() {
  try {
    const jobName = options.job;
    
    console.log(`🚀 Starting FF14 skills scraper for job: ${jobName}`);
    
    // スキルデータを取得
    const skillData = await scrapeFF14Skills(jobName);
    
    // JSONファイルを保存
    const outputPath = await saveSkillData(skillData, jobName);
    
    console.log(`✅ Successfully scraped ${skillData.skills.length} skills for ${jobName}`);
    console.log(`📁 Output file: ${outputPath}`);
    
    // スキル一覧をログ出力（verbose モード）
    if (options.verbose) {
      console.log('\n📋 Scraped Skills:');
      skillData.skills.forEach((skill, index) => {
        console.log(`  ${index + 1}. ${skill.name} (Lv.${skill.level}, ${skill.skill_type})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain関数を実行
if (require.main === module) {
  main();
}

module.exports = {
  scrapeFF14Skills,
  saveSkillData,
  JOB_MAPPINGS
};