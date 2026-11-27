import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeCsv } from './csv.js';

test('quotes commas and double quotes and treats formula-like labels as text', () => {
  assert.equal(encodeCsv([['Name', 'Tasks'], ['Riya "QA", Inc.', -2], ['  =A1', 1], ['@home', 3]]),
    ['"Name","Tasks"', '"Riya ""QA"", Inc.","-2"', `"'  =A1","1"`, `"'@home","3"`].join('\r\n'));
});
