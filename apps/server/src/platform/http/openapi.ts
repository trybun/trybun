import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/** The OpenAPI document generated from the contract schemas of the handlers (§12.1, §18.3). */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder().setTitle('Trybun API').setVersion('1').build();
  return SwaggerModule.createDocument(app, config);
}
