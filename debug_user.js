const fs = require('fs');
const https = require('https');

const content = fs.readFileSync('.env.local', 'utf8');
const urlMatch = content.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.log('Missing URL or Key in .env.local');
  process.exit(1);
}

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

const email = 'adfusiondev@gmail.com';
const apiUrl = `${url}/rest/v1/profiles?email=eq.${email}&select=*`;

console.log(`Checking profile for ${email}...`);

const options = {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
};

https.get(apiUrl, options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Profile Data:');
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Error parsing JSON:', data);
    }
  });
}).on('error', (e) => {
  console.error('Request Error:', e);
});
