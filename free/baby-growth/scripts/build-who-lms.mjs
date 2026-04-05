import https from "https";

const files = [
  ["boy", "wfa", "WHO-Boys-Weight-for-age-Percentiles.csv"],
  ["girl", "wfa", "WHO-Girls-Weight-for-age%20Percentiles.csv"],
  ["boy", "lfa", "WHO-Boys-Length-for-age-Percentiles.csv"],
  ["girl", "lfa", "WHO-Girls-Length-for-age-Percentiles.csv"],
  ["boy", "hcfa", "WHO-Boys-Head-Circumference-for-age-Percentiles.csv"],
  ["girl", "hcfa", "WHO-Girls-Head-Circumference-for-age-Percentiles.csv"]
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const out = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",");
    const row = {
      month: Number(parts[0]),
      L: Number(parts[1]),
      M: Number(parts[2]),
      S: Number(parts[3])
    };
    if (Number.isFinite(row.month) && Number.isFinite(row.L) && Number.isFinite(row.M) && Number.isFinite(row.S)) {
      out.push(row);
    }
  }
  return out;
}

const base = "https://ftp.cdc.gov/pub/Health_Statistics/NCHS/growthcharts/";
const data = { boy: {}, girl: {} };

for (const [sex, key, fn] of files) {
  const text = await fetchText(base + fn);
  data[sex][key] = parseCsv(text);
  console.error("ok", fn, data[sex][key].length);
}

const banner = `/* WHO Child Growth Standards LMS (L, M, S) by completed month 0-24.
 * Source: CDC NCHS WHO chart data files (LMS matches WHO Child Growth Standards).
 * https://www.cdc.gov/growthcharts/who-data-files.htm
 * Regenerate: node scripts/build-who-lms.mjs > tool/lib/who-lms-data.js
 */

`;

process.stdout.write(`${banner}export const WHO_LMS_BY_SEX = ${JSON.stringify(data)};\n`);
