/* Real Expo web walkthrough. Native services remain testing-ground adapters. */
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const output = process.argv[2];
if (!output) throw new Error('Pass an absolute artifact output directory');
const baseURL = process.env.WELCOME_BASE_URL || 'http://127.0.0.1:5173';
const boot = { harness:'neptranslate-testing-ground', translateMode:'recorded', offline:true,
  neuralReady:false, speechPermission:'granted', cameraPermission:'granted',
  acknowledgeStartupConsent:'require', ocrFixture:null, translations:[], seed:'welcome-updated' };
const consent = { version:'2026-09-23.startup', terms:true, privacy:true, age18Plus:false, accepted_at:'2026-10-01T12:00:00Z' };

(async () => {
  fs.mkdirSync(output, { recursive:true });
  const browser = await chromium.launch({ ...(process.platform === 'win32' ? { channel:'msedge' } : {}), headless:true });
  const results = [];
  const seed = async (page, daily = false) => page.addInitScript(({boot, consent, daily}) => {
    window.__NEPTRANSLATE_TG__ = boot;
    if (daily && !localStorage.getItem('neptranslate.dailyOpen.v2')) {
      localStorage.setItem('neptranslate.startup_consent.v1', JSON.stringify(consent));
      localStorage.setItem('neptranslate.installation.v1', 'inst_updated_daily');
      localStorage.setItem('neptranslate.dailyOpen.v2', JSON.stringify({schemaVersion:2,
        installationId:'inst_updated_daily', nyDate:'2020-01-01', untilMs:0, adDismissed:true,
        welcomed:true, pendingFlight:null, receipt:'inst_updated_daily:2020-01-01'}));
    }
  }, { boot, consent, daily });
  const config = {viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'no-preference'};
  try {
    for (const daily of [false,true]) {
      const name = daily ? 'updated_recurring_daily_open' : 'updated_new_user_introduction';
      const context = await browser.newContext({...config,recordVideo:{dir:output,size:config.viewport}});
      const page = await context.newPage(); await seed(page, daily);
      const started = Date.now(); const events = [];
      const mark = label => { const event={label,elapsedMs:Date.now()-started}; events.push(event); console.log(name,JSON.stringify(event)); };
      await page.goto(baseURL+'/hosted-app/index.html',{waitUntil:'domcontentloaded'});
      if (!daily) {
        await page.getByTestId('startup-consent-gate').waitFor(); mark('consent_visible');
        await page.waitForTimeout(10000);
        await page.getByTestId('startup-consent-terms').click();
        await page.waitForTimeout(1500);
        await page.getByTestId('startup-consent-privacy').click();
        await page.waitForTimeout(1500);
        await page.getByTestId('startup-consent-continue').click();
      }
      await page.getByTestId('credit-award-card').waitFor(); mark('readable_award_visible');
      await expect(page.getByTestId('credit-award-body')).toContainText(daily ? '5 credits for today' : '10 credits to start');
      await expect(page.getByTestId('welcome-card')).toHaveCount(0);
      await expect(page.getByTestId('daily-open-ad')).toHaveCount(0);
      await expect(page.getByTestId('credits-gauge-fill')).toHaveCount(0);
      await page.waitForTimeout(5000);
      await expect(page.getByTestId('credit-award-card')).toBeVisible();
      await expect(page.getByTestId('credit-award-coin-0')).toHaveCount(0);
      await page.screenshot({path:path.join(output,name+'_popup.png')});
      const popupBounds=await page.getByTestId('credit-award-card').boundingBox();
      const pillBounds=await page.getByTestId('credits-gauge').boundingBox();
      const timerBefore=await page.getByTestId('credits-gauge-face').boundingBox();
      if (popupBounds.height>=700 || pillBounds.width>=150 || pillBounds.x<200) throw new Error('Popup/pill geometry violates requested layout');
      const unacknowledged=await context.storageState();
      const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('neptranslate.dailyOpen.v2')));
      await page.getByTestId('credit-award-collect').click(); mark('continue_clicked');
      await expect(page.getByTestId('credit-award-card')).toHaveCount(0);
      await page.getByTestId('credit-award-coin-0').waitFor(); mark('coins_visible_over_home');
      const acknowledged=await context.storageState();
      await expect(page.getByTestId('translate-input')).toBeVisible();
      await page.waitForTimeout(350);
      await page.screenshot({path:path.join(output,name+'_coins.png'),animations:'allow'});
      await page.getByTestId('credit-award-overlay').waitFor({state:'hidden'}); mark('award_finished');
      await page.waitForTimeout(3000);
      await page.screenshot({path:path.join(output,name+'_home.png')});
      const timerAfter=await page.getByTestId('credits-gauge-face').boundingBox();
      const coinAfter=await page.getByTestId('credits-gauge-coin').boundingBox();
      if (timerAfter.width <= timerBefore.width || coinAfter.x + coinAfter.width > timerAfter.x) throw new Error('Timer did not widen or coin overlaps pill');
      const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('neptranslate.dailyOpen.v2')));
      if (after.untilMs!==before.untilMs || after.pendingFlight!==null) throw new Error('Grant changed or pending flight not cleared');
      const complete=await context.storageState();
      const video=page.video(); await context.close();
      fs.renameSync(await video.path(),path.join(output,name+'.webm'));
      const recovery=[];
      for (const [state,storageState] of [['unacknowledged',unacknowledged],['acknowledged',acknowledged],['complete',complete]]) {
        const recoveryContext=await browser.newContext({...config,storageState});
        const recoveryPage=await recoveryContext.newPage(); await seed(recoveryPage);
        await recoveryPage.goto(baseURL+'/hosted-app/index.html');
        await recoveryPage.getByTestId('app-shell').waitFor();
        if (state==='unacknowledged') await expect(recoveryPage.getByTestId('credit-award-card')).toBeVisible();
        else if (state==='acknowledged') {
          await expect(recoveryPage.getByTestId('credit-award-card')).toHaveCount(0);
          await recoveryPage.getByTestId('credit-award-overlay').waitFor({state:'hidden'});
        } else { await recoveryPage.waitForTimeout(500); await expect(recoveryPage.getByTestId('credit-award-overlay')).toHaveCount(0); }
        const record=await recoveryPage.evaluate(()=>JSON.parse(localStorage.getItem('neptranslate.dailyOpen.v2')));
        if (record.untilMs!==before.untilMs || record.receipt!==before.receipt) throw new Error('Restart double-granted '+state);
        recovery.push({state,grantUnchanged:true}); await recoveryContext.close();
      }
      results.push({name,events,popupBounds,pillBounds,timerBefore,timerAfter,coinAfter,before,after,recovery,native:false,animationSpeed:'normal'});
    }
    fs.writeFileSync(path.join(output,'updated_welcome_proof.json'),JSON.stringify(results,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
