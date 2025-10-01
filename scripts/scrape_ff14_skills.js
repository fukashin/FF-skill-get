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
function determineSkillType(skillElement, skillName) {
  // アイコンやクラス名から判定
  const iconSrc = skillElement.querySelector('img')?.src || '';
  const skillText = skillElement.textContent.toLowerCase();
  
  // ウェポンスキル
  if (iconSrc.includes('weaponskill') || skillText.includes('weapon')) {
    return 'weaponskill';
  }
  
  // 魔法
  if (iconSrc.includes('spell') || skillText.includes('spell') || skillText.includes('magic')) {
    return 'spell';
  }
  
  // アビリティ
  if (iconSrc.includes('ability') || skillText.includes('ability')) {
    return 'ability';
  }
  
  // 特性
  if (iconSrc.includes('trait') || skillText.includes('trait')) {
    return 'trait';
  }
  
  // リミットブレイク
  if (skillName.includes('リミット') || skillName.includes('limit')) {
    return 'limit_break';
  }
  
  // デフォルト
  return 'ability';
}

/**
 * クールタイムとキャスト時間を解析
 */
function parseSkillTiming(timingText) {
  const result = {
    cooldown: 0,      // クールタイム（0.01秒単位）
    cast_time: 0,     // キャスト時間（0.01秒単位）
    recast_time: 0    // リキャスト時間（0.01秒単位）
  };
  
  if (!timingText) return result;
  
  // クールタイム抽出（例：「再使用時間：60秒」）
  const cooldownMatch = timingText.match(/再使用時間[：:]\s*(\d+(?:\.\d+)?)\s*秒/);
  if (cooldownMatch) {
    result.cooldown = Math.round(parseFloat(cooldownMatch[1]) * 100);
  }
  
  // キャスト時間抽出（例：「詠唱時間：2.5秒」）
  const castMatch = timingText.match(/詠唱時間[：:]\s*(\d+(?:\.\d+)?)\s*秒/);
  if (castMatch) {
    result.cast_time = Math.round(parseFloat(castMatch[1]) * 100);
  }
  
  // リキャスト時間抽出（例：「リキャスト：2.5秒」）
  const recastMatch = timingText.match(/リキャスト[：:]\s*(\d+(?:\.\d+)?)\s*秒/);
  if (recastMatch) {
    result.recast_time = Math.round(parseFloat(recastMatch[1]) * 100);
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
      const skillElements = document.querySelectorAll('.job_skill_detail, .skill_detail, .job__skill_detail, [class*="skill"]');
      const extractedSkills = [];
      
      skillElements.forEach((skillEl, index) => {
        try {
          // スキル名を取得
          const nameEl = skillEl.querySelector('.skill_name, .job__skill_name, h3, h4, .title') || 
                        skillEl.querySelector('[class*="name"]') ||
                        skillEl.querySelector('strong');
          
          const skillName = nameEl ? nameEl.textContent.trim() : `Unknown Skill ${index + 1}`;
          
          if (!skillName || skillName === '') return;
          
          // スキル説明を取得
          const descEl = skillEl.querySelector('.skill_desc, .job__skill_desc, .description, p') ||
                        skillEl.querySelector('[class*="desc"]');
          const description = descEl ? descEl.textContent.trim() : '';
          
          // レベル情報を取得
          const levelEl = skillEl.querySelector('.skill_level, .job__skill_level, [class*="level"]');
          const levelText = levelEl ? levelEl.textContent : '';
          const levelMatch = levelText.match(/(\d+)/);
          const level = levelMatch ? parseInt(levelMatch[1]) : 1;
          
          // タイミング情報を取得
          const timingEl = skillEl.querySelector('.skill_timing, .job__skill_timing, [class*="timing"]');
          const timingText = timingEl ? timingEl.textContent : '';
          
          // アイコンURL取得
          const iconEl = skillEl.querySelector('img');
          const iconUrl = iconEl ? iconEl.src : '';
          
          extractedSkills.push({
            name: skillName,
            description: description,
            level: level,
            timing_text: timingText,
            icon_url: iconUrl,
            job_role: jobRole,
            job_name: jobName,
            raw_html: skillEl.innerHTML.substring(0, 500) // デバッグ用
          });
        } catch (error) {
          console.error('Error processing skill element:', error);
        }
      });
      
      return extractedSkills;
    }, jobInfo.role, jobName);
    
    if (options.verbose) {
      console.log(`📊 Found ${skills.length} skills for ${jobInfo.display_name}`);
    }
    
    // スキルデータを整形
    const processedSkills = skills.map((skill, index) => {
      const timing = parseSkillTiming(skill.timing_text);
      const skillType = determineSkillType({ textContent: skill.description + skill.timing_text }, skill.name);
      
      return {
        id: `${jobName}_skill_${index + 1}`,
        name: skill.name,
        description: skill.description,
        level: skill.level,
        job_role: skill.job_role,
        skill_type: skillType,
        cooldown: timing.cooldown,
        cast_time: timing.cast_time,
        recast_time: timing.recast_time,
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