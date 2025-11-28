import { validateCode } from '../../../services/code/validator';

describe('Code Validator', () => {
  describe('validateCode', () => {
    it('should validate safe Python code', () => {
      const safeCode = `
def calculate_sum(a, b):
    return a + b

result = calculate_sum(1, 2)
print(result)
      `;

      const result = validateCode(safeCode);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject code with forbidden imports', () => {
      const dangerousCode = `
import os
os.system('rm -rf /')
      `;

      const result = validateCode(dangerousCode);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject code with eval', () => {
      const dangerousCode = `
code = "print('hello')"
eval(code)
      `;

      const result = validateCode(dangerousCode);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('eval'))).toBe(true);
    });

    it('should reject code with subprocess', () => {
      const dangerousCode = `
import subprocess
subprocess.call(['ls', '-la'])
      `;

      const result = validateCode(dangerousCode);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect mismatched brackets', () => {
      const invalidCode = `
def test(
    return True
      `;

      const result = validateCode(invalidCode);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('괄호'))).toBe(true);
    });

    it('should warn about potentially dangerous patterns', () => {
      const warningCode = `
import requests
response = requests.get('https://example.com')
      `;

      const result = validateCode(warningCode);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

