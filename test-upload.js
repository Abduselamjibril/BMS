const fetch = require('node-fetch'); // or use native fetch if node >= 18
const FormData = require('form-data');
const fs = require('fs');

async function testUpload() {
  const fd = new FormData();
  fd.append('tenant_id', '0856cfca-ba35-472c-8d22-2befb60821dd');
  fd.append('type', 'Passport');
  // Create a dummy file
  fs.writeFileSync('test.png', 'dummy image content');
  fd.append('file', fs.createReadStream('test.png'), 'test.png');

  try {
    const res = await fetch('http://localhost:3000/documents', {
      method: 'POST',
      body: fd
    });
    const json = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", JSON.stringify(json, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    fs.unlinkSync('test.png');
  }
}

testUpload();
