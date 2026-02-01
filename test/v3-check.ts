import axios from 'axios';

const API_URL = 'https://api.onswitch.xyz';
// The key user provided for this turn
const API_KEY = 'T9bV4xN7hM3pW8zC5yF1kD6L';

async function testAuth() {
    console.log(`Testing connection to ${API_URL}...`);

    // Basic Auth Test
    try {
        console.log(`\nTesting Basic Auth (username=key)`);
        const response = await axios.get(`${API_URL}/asset`, {
            auth: { username: API_KEY, password: '' }
        });
        console.log(`✅ SUCCESS! Status: ${response.status}`);
        return;
    } catch (error: any) {
        console.log(`❌ FAILED Basic Auth. Status: ${error.response?.status}`);
    }

    // Query Param Test
    try {
        console.log(`\nTesting Query Param (?x-api-key=key)`);
        const response = await axios.get(`${API_URL}/asset?x-api-key=${API_KEY}`);
        console.log(`✅ SUCCESS! Status: ${response.status}`);
        return;
    } catch (error: any) {
        console.log(`❌ FAILED Query Param (?x-api-key). Status: ${error.response?.status}`);
    }

    // Query Param Test 2
    try {
        console.log(`\nTesting Query Param (?key=key)`);
        const response = await axios.get(`${API_URL}/asset?key=${API_KEY}`);
        console.log(`✅ SUCCESS! Status: ${response.status}`);
        return;
    } catch (error: any) {
        console.log(`❌ FAILED Query Param (?key). Status: ${error.response?.status}`);
    }

    const headersList = [
        { 'x-api-key': API_KEY },
        { 'Authorization': `Bearer ${API_KEY}` },
        { 'Authorization': API_KEY },
        { 'x-auth-token': API_KEY },
        { 'api-key': API_KEY },
        { 'token': API_KEY },
        { 'auth-token': API_KEY },
        { 'X-Switch-API-Key': API_KEY }
    ];

    for (const headers of headersList) {
        try {
            console.log(`\nTesting headers: ${JSON.stringify(headers)}`);
            const response = await axios.get(`${API_URL}/asset`, { headers });
            console.log(`✅ SUCCESS! Status: ${response.status}`);
            console.log('Data:', JSON.stringify(response.data, null, 2));
            return; // Found the working one
        } catch (error: any) {
            console.log(`❌ FAILED. Status: ${error.response?.status}`);
            if (error.response?.data) {
                // console.log('Response:', JSON.stringify(error.response.data));
                // keeping it clean
            } else {
                // console.log('Error:', error.message);
            }
        }
    }
}

testAuth();
