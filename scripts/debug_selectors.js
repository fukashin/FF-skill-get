#!/usr/bin/env node

/**
 * FF14公式サイトのHTML構造をデバッグするスクリプト
 */

const puppeteer = require('puppeteer');

async function debugSelectors() {
  const url = 'https://jp.finalfantasyxiv.com/jobguide/paladin/';
  
  console.log(`🔍 Debugging selectors for: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: false, // ブラウザを表示して確認
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
    
    // ページが完全に読み込まれるまで待機
    await page.waitForTimeout(3000);
    
    // HTML構造を調査
    const pageInfo = await page.evaluate(() => {
      // 可能性のあるセレクターをテスト
      const selectors = [
        '.job_skill_detail',
        '.skill_detail', 
        '.job__skill_detail',
        '[class*="skill"]',
        '.job-skill',
        '.skill-item',
        '.action-detail',
        '.action-item'
      ];
      
      const results = {};
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        results[selector] = {
          count: elements.length,
          sample: elements.length > 0 ? {
            html: elements[0].outerHTML.substring(0, 500),
            text: elements[0].textContent.substring(0, 200)
          } : null
        };
      });
      
      // 全体のHTML構造も確認
      const bodyClasses = document.body.className;
      const mainContent = document.querySelector('main, .main, #main, .content');
      
      return {
        bodyClasses,
        mainContentHTML: mainContent ? mainContent.outerHTML.substring(0, 1000) : 'Not found',
        selectorResults: results,
        allClassNames: Array.from(document.querySelectorAll('*')).map(el => el.className).filter(c => c && c.includes('skill')).slice(0, 20)
      };
    });
    
    console.log('📊 Page Analysis Results:');
    console.log('Body Classes:', pageInfo.bodyClasses);
    console.log('\n🔍 Selector Test Results:');
    
    Object.entries(pageInfo.selectorResults).forEach(([selector, result]) => {
      console.log(`\n${selector}: ${result.count} elements found`);
      if (result.sample) {
        console.log('Sample HTML:', result.sample.html);
        console.log('Sample Text:', result.sample.text);
      }
    });
    
    console.log('\n📝 Skill-related class names found:');
    pageInfo.allClassNames.forEach(className => {
      console.log(`  - ${className}`);
    });
    
    // 5秒待機してブラウザを閉じる
    await page.waitForTimeout(5000);
    
  } finally {
    await browser.close();
  }
}

debugSelectors().catch(console.error);