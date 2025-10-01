#!/usr/bin/env node

/**
 * 全FF14ジョブのスキルデータを一括取得
 * Usage: node scripts/scrape_all_jobs.js [--output data] [--verbose]
 */

const { scrapeFF14Skills, saveSkillData, JOB_MAPPINGS } = require('./scrape_ff14_skills');
const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');

// コマンドライン引数の設定
program
  .option('-o, --output <path>', 'Output directory', 'data')
  .option('-v, --verbose', 'Verbose output')
  .option('-j, --jobs <jobs>', 'Comma-separated job names (default: all)', '')
  .option('--delay <ms>', 'Delay between requests (ms)', '2000')
  .parse();

const options = program.opts();

/**
 * 指定されたジョブリストを取得
 */
function getJobsToScrape() {
  if (options.jobs) {
    const jobList = options.jobs.split(',').map(j => j.trim());
    const validJobs = jobList.filter(job => JOB_MAPPINGS[job]);
    const invalidJobs = jobList.filter(job => !JOB_MAPPINGS[job]);
    
    if (invalidJobs.length > 0) {
      console.warn(`⚠️ Invalid jobs ignored: ${invalidJobs.join(', ')}`);
    }
    
    return validJobs;
  }
  
  return Object.keys(JOB_MAPPINGS);
}

/**
 * 統合されたスキルデータファイルを作成
 */
async function createCombinedSkillsFile(allSkillsData) {
  const combinedData = {
    metadata: {
      total_jobs: allSkillsData.length,
      total_skills: allSkillsData.reduce((sum, data) => sum + data.skills.length, 0),
      scraped_at: new Date().toISOString(),
      scraper_version: '1.0.0',
      jobs: allSkillsData.map(data => ({
        job_name: data.metadata.job_name,
        job_display_name: data.metadata.job_display_name,
        job_role: data.metadata.job_role,
        skills_count: data.skills.length
      }))
    },
    skills_by_job: {}
  };
  
  // ジョブ別にスキルデータを整理
  allSkillsData.forEach(data => {
    combinedData.skills_by_job[data.metadata.job_name] = {
      metadata: data.metadata,
      skills: data.skills
    };
  });
  
  // 全スキルを1つの配列にまとめたバージョンも作成
  combinedData.all_skills = allSkillsData.reduce((allSkills, data) => {
    return allSkills.concat(data.skills);
  }, []);
  
  // 統合ファイルを保存
  const outputDir = path.resolve(options.output);
  const combinedPath = path.join(outputDir, 'all_ff14_skills.json');
  
  await fs.writeFile(combinedPath, JSON.stringify(combinedData, null, 2), 'utf8');
  
  if (options.verbose) {
    console.log(`📄 Combined skills file created: ${combinedPath}`);
  }
  
  return combinedPath;
}

/**
 * スクレイピング結果のサマリーを作成
 */
function createSummary(results) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 FF14 Skills Scraping Summary');
  console.log('='.repeat(50));
  console.log(`✅ Successful: ${successful.length} jobs`);
  console.log(`❌ Failed: ${failed.length} jobs`);
  console.log(`📈 Total skills scraped: ${successful.reduce((sum, r) => sum + (r.skillsCount || 0), 0)}`);
  
  if (successful.length > 0) {
    console.log('\n✅ Successfully scraped jobs:');
    successful.forEach(result => {
      console.log(`  - ${result.jobName}: ${result.skillsCount} skills`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed jobs:');
    failed.forEach(result => {
      console.log(`  - ${result.jobName}: ${result.error}`);
    });
  }
  
  console.log('='.repeat(50));
}

/**
 * メイン実行関数
 */
async function main() {
  const jobs = getJobsToScrape();
  const delay = parseInt(options.delay);
  
  console.log(`🚀 Starting FF14 skills scraper for ${jobs.length} jobs`);
  console.log(`📝 Jobs to scrape: ${jobs.join(', ')}`);
  console.log(`⏱️ Delay between requests: ${delay}ms`);
  
  const results = [];
  const allSkillsData = [];
  
  // 各ジョブを順次処理
  for (let i = 0; i < jobs.length; i++) {
    const jobName = jobs[i];
    
    try {
      if (options.verbose) {
        console.log(`\n🔍 [${i + 1}/${jobs.length}] Processing ${jobName}...`);
      }
      
      // スキルデータを取得
      const skillData = await scrapeFF14Skills(jobName);
      
      // JSONファイルを保存
      await saveSkillData(skillData, jobName);
      
      results.push({
        success: true,
        jobName: jobName,
        skillsCount: skillData.skills.length
      });
      
      allSkillsData.push(skillData);
      
      if (options.verbose) {
        console.log(`✅ ${jobName}: ${skillData.skills.length} skills scraped`);
      }
      
      // 次のリクエストまで待機（最後のジョブは除く）
      if (i < jobs.length - 1) {
        if (options.verbose) {
          console.log(`⏱️ Waiting ${delay}ms before next request...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
    } catch (error) {
      console.error(`❌ Error scraping ${jobName}:`, error.message);
      
      results.push({
        success: false,
        jobName: jobName,
        error: error.message
      });
      
      // エラーが発生しても続行
      continue;
    }
  }
  
  // 統合ファイルを作成
  if (allSkillsData.length > 0) {
    try {
      await createCombinedSkillsFile(allSkillsData);
      console.log(`📄 Combined skills file created successfully`);
    } catch (error) {
      console.error('❌ Error creating combined file:', error.message);
    }
  }
  
  // 結果サマリーを表示
  createSummary(results);
  
  // 失敗があった場合は終了コード1で終了
  const failedCount = results.filter(r => !r.success).length;
  if (failedCount > 0) {
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain関数を実行
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  getJobsToScrape,
  createCombinedSkillsFile
};