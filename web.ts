// dt.bat/deno task web どちらでも動くように 'web' をスキップ
let url = Deno.args[0];
if (url === "web") {
  url = Deno.args[1];
}

if (!url) {
  console.error("Usage: deno task web <URL>");
  Deno.exit(1);
}

const response = await fetch(url);
const text = await response.text();
console.log(text);
