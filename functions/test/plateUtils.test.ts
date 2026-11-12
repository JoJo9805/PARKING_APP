import * as fs from "fs";
import * as path from "path";
import { PlateUtils } from "../src/domain/plateUtils";

describe("PlateUtils (Contracts Verification)", () => {
  const contractPath = path.resolve(__dirname, "../../contracts/plate_test_cases.json");
  const testCases = JSON.parse(fs.readFileSync(contractPath, "utf-8"));

  testCases.forEach((tc: any, index: number) => {
    it(`Case ${index + 1}: ${tc.raw} -> ${tc.expectedNormalized} (${tc.description})`, () => {
      const normalized = PlateUtils.normalize(tc.raw);
      expect(normalized).toBe(tc.expectedNormalized);

      const isValid = PlateUtils.isValid(normalized);
      expect(isValid).toBe(tc.isValid);
    });
  });
});
