export function log(message: string, source = "express") {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  const formattedTime = `${h}:${m}:${s}`;

  console.log(`${formattedTime} [${source}] ${message}`);
}
