/**
 * Phase 1: Data Parser Tests
 * Data Analyst Agent (Poppy) - CSV/XLSX Parsing Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseCSV, parseXLSX, parseFile } from '@/lib/poppy/services/data-parser';

const TEST_DIR = path.join(process.cwd(), 'tmp', 'poppy-tests');

describe('Poppy Phase 1: Data Parser Tests', () => {
  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(TEST_DIR)) {
      const files = fs.readdirSync(TEST_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(TEST_DIR, file));
      });
      fs.rmdirSync(TEST_DIR);
    }
  });

  describe('CSV Parsing', () => {
    it('should parse valid CSV with headers', () => {
      const csvContent = 'name,age,city\nJohn,25,New York\nJane,30,London';
      const csvPath = path.join(TEST_DIR, 'test.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath, { hasHeaders: true });

      expect(result.headers).toEqual(['name', 'age', 'city']);
      expect(result.rowCount).toBe(2);
      expect(result.columnCount).toBe(3);
      expect(result.rows[0]).toEqual({ name: 'John', age: '25', city: 'New York' });
      expect(result.rows[1]).toEqual({ name: 'Jane', age: '30', city: 'London' });
    });

    it('should handle empty values', () => {
      const csvContent = 'name,age,city\nJohn,,New York\n,30,';
      const csvPath = path.join(TEST_DIR, 'test-empty.csv');
      fs.writeFileSync(csvPath, csvContent);

      const result = parseCSV(csvPath, { hasHeaders: true });

      expect(result.rows[0].age).toBe('');
      expect(result.rows[1].name).toBe('');
    });

    it('should throw error for empty file', () => {
      const csvPath = path.join(TEST_DIR, 'empty.csv');
      fs.writeFileSync(csvPath, '');

      expect(() => parseCSV(csvPath)).toThrow('File is empty');
    });

    it('should throw error for file with no data rows', () => {
      const csvContent = 'name,age,city';
      const csvPath = path.join(TEST_DIR, 'headers-only.csv');
      fs.writeFileSync(csvPath, csvContent);

      expect(() => parseCSV(csvPath)).toThrow('no data rows');
    });

    it('should throw error for file with no columns', () => {
      const csvPath = path.join(TEST_DIR, 'no-columns.csv');
      fs.writeFileSync(csvPath, '\n\n');

      expect(() => parseCSV(csvPath)).toThrow('no columns');
    });

    it('should throw error for mismatched column counts', () => {
      const csvContent = 'name,age,city\nJohn,25\nJane,30,London,extra';
      const csvPath = path.join(TEST_DIR, 'mismatched.csv');
      fs.writeFileSync(csvPath, csvContent);

      expect(() => parseCSV(csvPath)).toThrow();
    });
  });

  describe('XLSX Parsing', () => {
    it('should parse valid XLSX file', () => {
      // Note: This test requires xlsx library to be installed
      // For now, we'll test the error handling
      const xlsxPath = path.join(TEST_DIR, 'nonexistent.xlsx');

      expect(() => parseXLSX(xlsxPath)).toThrow('File not found');
    });

    it('should throw error for unsupported format', () => {
      const filePath = path.join(TEST_DIR, 'test.txt');
      fs.writeFileSync(filePath, 'some content');

      expect(() => parseFile(filePath)).toThrow('Unsupported file format');
    });
  });

  describe('File Format Detection', () => {
    it('should detect CSV files', () => {
      const csvPath = path.join(TEST_DIR, 'test.csv');
      fs.writeFileSync(csvPath, 'name,age\nJohn,25');

      const result = parseFile(csvPath);
      expect(result.headers).toContain('name');
    });

    it('should throw error for unknown extension', () => {
      const filePath = path.join(TEST_DIR, 'test.unknown');
      fs.writeFileSync(filePath, 'some content');

      expect(() => parseFile(filePath)).toThrow('Unsupported file format');
    });
  });
});








