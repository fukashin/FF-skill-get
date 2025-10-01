#!/usr/bin/env node

/**
 * FF14公式サイトの詳細なHTML構造をデバッグするスクリプト
 */

const puppeteer = require('puppeteer');

async function debugDetailed() {
  const url = 'https://jp.finalfantasyxiv.com/jobguide/paladin/';
  
  console.log(`🔍 Detailed debugging for: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security'
    ]
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    // スキル詳細情報を調査
    const skillInfo = await page.evaluate(() => {
      // スキルアイコンを取得
      const skillIcons = document.querySelectorAll('.job__skill_icon');
      const skills = [];
      
      skillIcons.forEach((icon, index) => {
        if (index < 5) { // 最初の5つのスキルを詳しく調査
          const skillName = icon.getAttribute('data-tooltip');
          const href = icon.getAttribute('href');
          const img = icon.querySelector('img');
          const iconUrl = img ? img.src : '';
          
          // 対応する詳細情報を探す
          let detailElement = null;
          if (href) {
            const targetId = href.replace('#', '');
            detailElement = document.getElementById(targetId);
          }
          
          skills.push({
            index,
            name: skillName,
            href,
            iconUrl,
            detailHTML: detailElement ? detailElement.outerHTML.substring(0, 1000) : 'Not found',
            detailText: detailElement ? detailElement.textContent.substring(0, 500) : 'Not found'
          });
        }
      });
      
      // PvE/PvPセクションも調査
      const sections = document.querySelectorAll('[id*="pve"], [id*="pvp"], .job__action');
      const sectionInfo = Array.from(sections).slice(0, 3).map(section => ({
        id: section.id,
        className: section.className,
        html: section.outerHTML.substring(0, 800),
        text: section.textContent.substring(0, 300)
      }));
      
      return {
        totalSkillIcons: skillIcons.length,
        skillSamples: skills,
        sections: sectionInfo
      };
    });
    
    console.log('📊 Detailed Analysis Results:');
    console.log(`Total skill icons found: ${skillInfo.totalSkillIcons}`);
    
    console.log('\n🎯 Skill Samples:');
    skillInfo.skillSamples.forEach(skill => {
      console.log(`\n--- Skill ${skill.index + 1} ---`);
      console.log(`Name: ${skill.name}`);
      console.log(`Href: ${skill.href}`);
      console.log(`Icon URL: ${skill.iconUrl}`);
      console.log(`Detail HTML: ${skill.detailHTML}`);
      console.log(`Detail Text: ${skill.detailText}`);
    });
    
    console.log('\n📋 Sections:');
    skillInfo.sections.forEach((section, index) => {
      console.log(`\n--- Section ${index + 1} ---`);
      console.log(`ID: ${section.id}`);
      console.log(`Class: ${section.className}`);
      console.log(`HTML: ${section.html}`);
    });
    
  } finally {
    await browser.close();
  }
}

debugDetailed().catch(console.error);