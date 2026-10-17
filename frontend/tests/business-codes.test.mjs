import test from "node:test";
import assert from "node:assert/strict";
import { code, parseCode, codeParams } from "../static/js/core/business_codes.js";
import { demoPaymentPayload } from "../static/js/core/payment_qr.js";

test("business codes grow past 999 and identifier filters retain numeric API values", () => {
  assert.equal(code("BN", 1), "BN_001");
  assert.equal(code("BN", 1000), "BN_1000");
  assert.equal(code("BN", null), "—");
  assert.equal(parseCode("bn_001", "BN"), 1);
  assert.equal(parseCode("1000", "BN"), 1000);
  for (const value of ["BS_001", "BN_000", "-1", "BN_1x", "9007199254740992"]) assert.throws(() => parseCode(value,"BN"));
  assert.deepEqual(codeParams({patient_id:"BN_001",schedule_id:"CA_1000",q:"Nguyễn",page:2}), {patient_id:1,schedule_id:1000,q:"Nguyễn",page:2});
});
test("QR accepts new demo references and keeps real bank references excluded", () => {
  const p = {transaction_status:"PENDING",transaction_code:"GD_DEMO_20261018_000239",amount:260000};
  assert.equal(JSON.parse(demoPaymentPayload(p)).transaction,p.transaction_code);
  for (const transaction_code of ["HT_DEMO_20261018_000239","GD_20261018_000239","GD_DEMO_invalid","BANK-real"]) assert.equal(demoPaymentPayload({...p,transaction_code}),null);
});
