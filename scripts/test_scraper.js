#!/usr/bin/env node

/**
 * スクレイパーのテスト用スクリプト
 * Usage: node scripts/test_scraper.js
 */

const { JOB_MAPPINGS } = require('./scrape_ff14_skills');

console.log('🧪 FF14 Skills Scraper Test');
console.log('============================');

// ジョブマッピングの確認
console.log('\n📋 Available Jobs:');
Object.entries(JOB_MAPPINGS).forEach(([jobName, jobInfo]) => {
  console.log(`  - ${jobName}: ${jobInfo.display_name} (${jobInfo.role})`);
});

console.log(`\n📊 Total jobs: ${Object.keys(JOB_MAPPINGS).length}`);

// 役職別の集計
const roleGroups = {};
Object.values(JOB_MAPPINGS).forEach(jobInfo => {
  if (!roleGroups[jobInfo.role]) {
    roleGroups[jobInfo.role] = [];
  }
  roleGroups[jobInfo.role].push(jobInfo.display_name);
});

console.log('\n📊 Jobs by Role:');
Object.entries(roleGroups).forEach(([role, jobs]) => {
  console.log(`  - ${role}: ${jobs.length} jobs (${jobs.join(', ')})`);
});

console.log('\n✅ Scraper configuration test completed!');
console.log('\n🚀 To run the scraper:');
console.log('  - Single job: node scrape_ff14_skills.js --job paladin --verbose');
console.log('  - All jobs: node scrape_all_jobs.js --verbose');
console.log('  - Specific jobs: node scrape_all_jobs.js --jobs "paladin,warrior" --verbose');