import fs from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
import prettier from 'prettier';
const generated = await prettier.format(
  astToString(
    await openapiTS(new URL('../../../docs/YARIZAN-OPENAPI-BACKEND-V2.json', import.meta.url)),
  ),
  { parser: 'typescript', singleQuote: true, printWidth: 100, trailingComma: 'all' },
);
const file = new URL('../shared/api.generated.ts', import.meta.url);
if (process.argv.includes('--write')) await fs.writeFile(file, generated);
else if ((await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n') !== generated)
  throw new Error('Generated API types drift: npm run contracts');
console.log('OpenAPI generated browser client types match implemented contracts');
