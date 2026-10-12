const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.join(__dirname, 'screenshots');
const BASE_URL = 'http://localhost:3000';
const DATASET_ID = '06390047-ef89-4508-b930-6fc7a47f5e05';
const TS_DATASET_ID = 'd364fef1-5de1-43ce-b868-1a24a43cb8c6';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function capture() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: {
      width: 1440,
      height: 960,
      deviceScaleFactor: 1.5
    },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // 1. Login Page
    console.log('Capturing 01_login_page.png...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await wait(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01_login_page.png') });

    // 2. Signup Page
    console.log('Capturing 02_signup_page.png...');
    await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle2' });
    await wait(1000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02_signup_page.png') });

    // Set authenticated user in localStorage
    await page.evaluate(() => {
      localStorage.setItem('user', JSON.stringify({ email: 'alex.developer@trueworth.ai', name: 'Alex Developer' }));
    });

    // 3. Home Dashboard
    console.log('Capturing 03_home_dashboard.png...');
    await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle2' });
    await wait(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03_home_dashboard.png') });

    // 4. EDA Dashboard
    console.log('Capturing 04_eda_dashboard.png...');
    await page.goto(`${BASE_URL}/eda/${DATASET_ID}`, { waitUntil: 'networkidle2' });
    await wait(2500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04_eda_dashboard.png') });

    // 5. Model Training Page
    console.log('Capturing 05_model_training.png...');
    await page.goto(`${BASE_URL}/train/${DATASET_ID}`, { waitUntil: 'networkidle2' });
    await wait(2000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '05_model_training.png') });

    // 6. Model Comparison Page
    console.log('Capturing 06_model_comparison.png...');
    await page.goto(`${BASE_URL}/compare/${DATASET_ID}`, { waitUntil: 'networkidle2' });
    await wait(2500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '06_model_comparison.png') });

    // 7. Explainability & Feature Importance Page
    console.log('Capturing 07_explainability_shap.png...');
    await page.goto(`${BASE_URL}/explainability/${DATASET_ID}`, { waitUntil: 'networkidle2' });
    await wait(3000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '07_explainability_shap.png') });

    // 8. Interactive Price Prediction Page with calculated estimate
    console.log('Capturing 08_price_prediction.png...');
    await page.goto(`${BASE_URL}/predict/${DATASET_ID}`, { waitUntil: 'networkidle2' });
    await wait(2000);

    try {
      // Type in numeric inputs
      const inputs = await page.$$('input');
      for (const input of inputs) {
        const placeholder = await page.evaluate(el => el.placeholder || '', input);
        if (placeholder.toLowerCase().includes('balcony')) {
          await input.type('2');
        } else if (placeholder.toLowerCase().includes('bath')) {
          await input.type('2');
        }
      }
      
      // Click Calculate Price button
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.innerText, btn);
        if (text.toLowerCase().includes('calculate price')) {
          await btn.click();
          console.log('Clicked Calculate Price!');
          await wait(2000);
          break;
        }
      }
    } catch (err) {
      console.log('Prediction interaction note:', err.message);
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, '08_price_prediction.png') });

    // 9. Time-Series Forecasting Page
    console.log('Capturing 09_timeseries_forecast.png...');
    await page.goto(`${BASE_URL}/forecast/${TS_DATASET_ID}`, { waitUntil: 'networkidle2' });
    await wait(2000);

    try {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.innerText, btn);
        if (text.includes('Generate Forecast') || text.includes('Forecast')) {
          await btn.click();
          await wait(2500);
          break;
        }
      }
    } catch (err) {
      console.log('Forecast interaction note:', err.message);
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, '09_timeseries_forecast.png') });

    console.log('All screenshots captured successfully in:', OUTPUT_DIR);
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

capture();
