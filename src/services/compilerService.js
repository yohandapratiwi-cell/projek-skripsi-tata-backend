const axios = require('axios');

const runCCode = async (code, stdin = "") => { // Tambahkan parameter stdin
  try {
    const response = await axios.post(
      "https://api.onecompiler.com/v1/run",
      {
        language: "c",
        stdin: stdin, // 👈 KIRIM INPUTAN DISINI
        files: [
          {
            name: "main.c",
            content: code
          }
        ]
      },
      {
        headers: {
          "X-OneCompiler-Key": process.env.ONECOMPILER_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    return {
      stdout: response.data.stdout || "",
      stderr: response.data.stderr || "",
      executionTime: response.data.executionTime || null
    };

  } catch (error) {
    throw new Error(error.response?.data?.message || "Compiler error");
  }
};

module.exports = { runCCode };