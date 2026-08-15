import SwaggerParser from '@apidevtools/swagger-parser';
import openApiDocument from '../docs/openapi/index.js';
import {
  EXPECTED_ROUTE_INVENTORY,
  OUT_OF_SCOPE_PATH_FRAGMENTS,
  getOperations,
  getRouteInventory,
} from '../docs/openapi/route-inventory.js';

const validateInventory = (document) => {
  const inventory = getRouteInventory(document);
  const expected = new Set(EXPECTED_ROUTE_INVENTORY);
  const actual = new Set(inventory);
  const missing = EXPECTED_ROUTE_INVENTORY.filter(
    (route) => !actual.has(route),
  );
  const extra = inventory.filter((route) => !expected.has(route));
  if (missing.length || extra.length) {
    throw new Error(
      `Route inventory mismatch; missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`,
    );
  }
};

const validateOperationIds = (document) => {
  const operationIds = getOperations(document).map(
    ({ operation }) => operation.operationId,
  );
  if (operationIds.some((operationId) => !operationId)) {
    throw new Error('Every operation must have an operationId');
  }
  if (new Set(operationIds).size !== operationIds.length) {
    throw new Error('Every operationId must be unique');
  }
};

const validateScope = (document) => {
  const rejected = Object.keys(document.paths).filter((path) =>
    OUT_OF_SCOPE_PATH_FRAGMENTS.some((fragment) =>
      path
        .toLowerCase()
        .split('/')
        .some((part) => part.includes(fragment)),
    ),
  );
  if (rejected.length) {
    throw new Error(`Out-of-scope paths found: ${rejected.join(', ')}`);
  }
};

try {
  await SwaggerParser.validate(openApiDocument);
  validateInventory(openApiDocument);
  validateOperationIds(openApiDocument);
  validateScope(openApiDocument);
  const pathCount = Object.keys(openApiDocument.paths).length;
  const operationCount = getOperations(openApiDocument).length;
  process.stdout.write(
    `OpenAPI ${openApiDocument.openapi} valid: ${pathCount} paths, ${operationCount} operations\n`,
  );
} catch (error) {
  console.error(`OpenAPI validation failed: ${error.message}`);
  process.exitCode = 1;
}
