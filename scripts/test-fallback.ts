const KEY = "zenith_ent_e27832d57aa05b53f111d4ecdf5feb44";
const url = "http://localhost:3000/proxy/jsonplaceholder.typicode.com/todos/1";

async function run() {
  console.log("Starting fallback test request...");
  try {
    const res = await fetch(url, {
      headers: { "X-Zenith-Key": KEY }
    });
    console.log("Status:", res.status);
    const data = await res.text();
    console.log("Data size:", data.length);
  } catch (e) {
    console.error("Request failed:", e);
  }
}

run();
