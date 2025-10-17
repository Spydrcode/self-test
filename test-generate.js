// const fetch = require('node-fetch');

async function testGenerate() {
  try {
    console.log("Testing /api/generate endpoint...");

    const response = await fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topics: ["javascript"],
        numQuestions: 3,
        difficulty: "junior",
      }),
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers.raw());

    const responseText = await response.text();
    console.log("Response body:", responseText);

    if (response.ok) {
      console.log("✅ Generate API call successful");
    } else {
      console.log("❌ Generate API call failed");
    }
  } catch (error) {
    console.error("❌ Error testing generate API:", error);
  }
}

testGenerate();
