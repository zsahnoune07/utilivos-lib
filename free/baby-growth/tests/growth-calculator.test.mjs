import test from "node:test";
import assert from "node:assert/strict";
import { WHO_LMS_BY_SEX } from "../tool/lib/who-lms-data.js";
import {
  DAYS_PER_MONTH,
  Z_P3,
  ageDaysToMonths,
  interpolateLms,
  lmsValueAtZ,
  normalCdf,
  valueToZScore,
  zScoreToPercentile
} from "../tool/lib/lms.js";
import {
  ageDaysBetweenLocalYmd,
  buildGrowthChartRows,
  computeGrowth,
  createEmptyFormState,
  metricToImperialWeight,
  weightToKg,
  lengthToCm
} from "../tool/lib/growth-calculator.js";

test("normalCdf(0) is about 0.5", () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
});

test("zScoreToPercentile(0) is about 50", () => {
  assert.ok(Math.abs(zScoreToPercentile(0) - 50) < 0.01);
});

test("lmsValueAtZ(0) equals median M", () => {
  const table = WHO_LMS_BY_SEX.boy.wfa;
  const lms = interpolateLms(table, 9);
  const x = lmsValueAtZ(lms, 0);
  assert.ok(Math.abs(x - lms.M) < 1e-6);
});

test("lmsValueAtZ inverts near z for weight LMS", () => {
  const table = WHO_LMS_BY_SEX.boy.wfa;
  const lms = interpolateLms(table, 6);
  const z0 = -0.5;
  const x = lmsValueAtZ(lms, z0);
  const z1 = valueToZScore(x, lms);
  assert.ok(Math.abs(z1 - z0) < 1e-4);
});

test("value at median yields z=0 and ~50th percentile", () => {
  const table = WHO_LMS_BY_SEX.boy.wfa;
  const lms = interpolateLms(table, 9);
  const z = valueToZScore(lms.M, lms);
  assert.ok(Math.abs(z) < 1e-9);
  const p = zScoreToPercentile(z);
  assert.ok(Math.abs(p - 50) < 0.1);
});

test("interpolateLms uses row at integer month", () => {
  const table = WHO_LMS_BY_SEX.girl.lfa;
  const a = interpolateLms(table, 6);
  const b = table[6];
  assert.equal(a.L, b.L);
  assert.equal(a.M, b.M);
  assert.equal(a.S, b.S);
});

test("ageDaysToMonths uses 30.4375", () => {
  assert.ok(Math.abs(ageDaysToMonths(DAYS_PER_MONTH) - 1) < 1e-9);
});

test("ageDaysBetweenLocalYmd counts calendar days", () => {
  assert.equal(ageDaysBetweenLocalYmd("2024-01-01", "2024-07-01"), 182);
});

test("weightToKg imperial 1 lb 0 oz", () => {
  const form = {
    unitSystem: "imperial",
    weightLb: "1",
    weightOz: "0"
  };
  const kg = weightToKg(form);
  assert.ok(kg != null && kg > 0.45 && kg < 0.46);
});

test("metricToImperialWeight round-trip near 4.5 kg", () => {
  const imp = metricToImperialWeight(4.5);
  const form = {
    unitSystem: "imperial",
    weightLb: imp.lb,
    weightOz: imp.oz,
    weightKg: ""
  };
  const kg = weightToKg(form);
  assert.ok(kg != null && Math.abs(kg - 4.5) < 0.02);
});

test("computeGrowth valid boy at median weight/length with fixed as-of date", () => {
  const form = createEmptyFormState();
  form.unitSystem = "metric";
  form.sex = "boy";
  form.birthDate = "2024-01-01";
  const asOfYmd = "2024-07-01";
  const ageDays = ageDaysBetweenLocalYmd(form.birthDate, asOfYmd);
  const months = ageDays / DAYS_PER_MONTH;
  const wfa = interpolateLms(WHO_LMS_BY_SEX.boy.wfa, months);
  const lfa = interpolateLms(WHO_LMS_BY_SEX.boy.lfa, months);
  form.weightKg = String(wfa.M);
  form.lengthCm = String(lfa.M);

  const out = computeGrowth(form, (key) => key, { asOfYmd });
  assert.equal(out.ok, true);
  assert.ok(out.result.weight);
  assert.ok(out.result.length);
  assert.ok(Math.abs(out.result.weight.p - 50) < 2);
  assert.ok(Math.abs(out.result.length.p - 50) < 2);
  assert.equal(out.result.asOfYmd, asOfYmd);
});

test("computeGrowth rejects 730 days since birth", () => {
  const form = createEmptyFormState();
  form.unitSystem = "metric";
  form.sex = "girl";
  form.birthDate = "2022-01-01";
  form.weightKg = "8";
  form.lengthCm = "70";
  const out = computeGrowth(form, (key) => key, { asOfYmd: "2024-01-01" });
  assert.equal(out.ok, false);
  assert.ok(out.validation.errors.birthDate);
});

test("buildGrowthChartRows returns weight and length", () => {
  const rows = buildGrowthChartRows("boy", 6, { weightKg: 8, lengthCm: 66, headCm: null });
  assert.ok(rows.length >= 2);
  assert.ok(rows[0].low < rows[0].mid && rows[0].mid < rows[0].high);
});

test("lengthToCm imperial 2 ft 0 in", () => {
  const form = {
    unitSystem: "imperial",
    lengthFt: "2",
    lengthIn: "0",
    lengthCm: ""
  };
  const cm = lengthToCm(form);
  assert.ok(cm != null && Math.abs(cm - 60.96) < 0.1);
});

test("Z_P3 is negative", () => {
  assert.ok(Z_P3 < 0);
});
