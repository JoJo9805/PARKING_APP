import * as fs from "fs";
import * as path from "path";
import { FeeCalculator } from "../src/domain/feeCalculator";

describe("FeeCalculator (Contracts Verification)", () => {
  const contractPath = path.resolve(__dirname, "../../contracts/fee_test_cases.json");
  const testCases = JSON.parse(fs.readFileSync(contractPath, "utf-8"));

  testCases.forEach((tc: any, index: number) => {
    it(`Case ${index + 1}: ${tc.description}`, () => {
      const result = FeeCalculator.calculateFee(
        tc.durationMin,
        tc.graceMinutes,
        tc.blockMinutes,
        tc.pricePerBlock,
        tc.depositApplied
      );

      expect(result.fee).toBe(tc.expectedFee);
      expect(result.depositRefund).toBe(tc.expectedDepositRefund);
      expect(result.amountCharged).toBe(tc.expectedAmountCharged);
    });
  });
});

