// LAZY AI SHITCODE
const https = require('https');
const fs = require('fs');
const { URL } = require('url');
// CONFIGURE THESE
const WEBHOOK_URL = 'WEBHOOK_URL_HERE'; 
const VERSION_FILE = 'fiddler_version.txt';
const CHECK_INTERVAL = 30 * 60 * 1000; // adjust
function getLatestExeUrl() {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    };
    https.get('https://api.getfiddler.com/win/latest',  options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(res.headers.location);
        } else if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.url) {
              resolve(json.url);
            } else {
              reject('Response JSON missing expected "url" field');
            }
          } catch (e) {
            reject('Failed to parse JSON response');
          }
        } else {
          reject(`Unexpected response: Status ${res.statusCode}`);
        }
      });
    }).on('error', (err) => {
      reject(`HTTP request error: ${err.message}`);
    });
  });
}
function extractVersion(filename) {
  const match = filename.match(/Fiddler[\s-]Everywhere[\s-]?(\d+\.\d+\.\d+)\.exe/i);
  return match ? match[1] : null;
}
function getStoredVersion() {
  try {
    return fs.readFileSync(VERSION_FILE, 'utf8').trim();
  } catch {
    return null;
  }
}
function storeVersion(version) {
  fs.writeFileSync(VERSION_FILE, version, 'utf8');
}
function notifyWebhook(version, exeUrl) {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = {
    content: `🎉 Latest fe_app version: \`${version}\`\n\`${exeUrl}\`\n[direct](${exeUrl}) - detected <t:${timestamp}:R>`
  };
  const data = JSON.stringify(message);
  const url = new URL(WEBHOOK_URL);
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };
  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('✅ Webhook notification sent successfully');
      } else {
        console.error(`❌ Webhook failed with status ${res.statusCode}: ${body}`);
      }
    });
  });
  req.on('error', (e) => {
    console.error(`❌ Webhook request error: ${e.message}`);
  });
  req.write(data);
  req.end();
}
async function checkForUpdate() {
  try {
    const exeUrl = await getLatestExeUrl();
    const filename = decodeURIComponent(exeUrl.split('/').pop());
    const latestVersion = extractVersion(filename);
    if (!latestVersion) {
      throw new Error('Could not extract version from filename');
    }
    const storedVersion = getStoredVersion();
    if (storedVersion !== latestVersion) {
      notifyWebhook(latestVersion, exeUrl);
      storeVersion(latestVersion);
      console.log(`✅ New version detected: ${latestVersion} (notified webhook)`);
    } else {
      console.log(`ℹ️ No new version. Current: ${latestVersion}`);
    }
  } catch (err) {
    console.error('❌ Error:', err);
  }
}
checkForUpdate();
setInterval(checkForUpdate, CHECK_INTERVAL);
