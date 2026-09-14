const { GoogleGenerativeAI } = require("@google/generative-ai");

async function run() {
    const apiKey = "AIzaSyALz13vOcJfCLc7fO1MHvRASUavnUQnRFU";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    try {
        const result = await model.generateContent("Hello, can you hear me?");
        const response = await result.response;
        console.log("Success:", response.text());
    } catch (error) {
        console.error("Error:", error);
    }
}

run();
